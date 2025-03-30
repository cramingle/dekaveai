import OpenAI from 'openai';
import logger from './logger';

// Define message structure matching OpenAI's API
export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: number; // Optional timestamp for tracking message age
}

// Configuration options for conversation management
interface ConversationConfig {
  maxMessages: number;      // Maximum number of messages to keep before summarizing
  maxTokensEstimate: number; // Approximate token limit to stay under
  systemPrompt: string;     // Default system prompt to use
}

// Default configuration
const DEFAULT_CONFIG: ConversationConfig = {
  maxMessages: 10,
  maxTokensEstimate: 4000, // Conservative estimate to avoid hitting context limits
  systemPrompt: "You are an AI assistant that helps generate product advertisements from images and text prompts."
};

export class ConversationManager {
  private messages: ConversationMessage[] = [];
  private config: ConversationConfig;
  private openai: OpenAI;

  constructor(apiKey: string, config: Partial<ConversationConfig> = {}) {
    // Initialize OpenAI client
    this.openai = new OpenAI({
      apiKey,
    });

    // Merge provided config with defaults
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Add initial system message
    this.messages.push({
      role: 'system',
      content: this.config.systemPrompt,
      timestamp: Date.now()
    });
  }

  /**
   * Add a user message to the conversation
   */
  public addUserMessage(content: string): void {
    this.messages.push({
      role: 'user',
      content,
      timestamp: Date.now()
    });
    
    // Check if conversation needs summarization
    this.checkAndSummarizeIfNeeded();
  }

  /**
   * Add an assistant (AI) message to the conversation
   */
  public addAssistantMessage(content: string): void {
    this.messages.push({
      role: 'assistant',
      content,
      timestamp: Date.now()
    });
  }

  /**
   * Get all messages in the conversation (for sending to OpenAI API)
   */
  public getMessages(): ConversationMessage[] {
    // Return messages without timestamps (OpenAI API doesn't expect them)
    return this.messages.map(({ role, content }) => ({ role, content }));
  }

  /**
   * Update the system prompt
   */
  public updateSystemPrompt(content: string): void {
    // Find existing system message
    const systemMessageIndex = this.messages.findIndex(msg => msg.role === 'system');
    
    if (systemMessageIndex >= 0) {
      this.messages[systemMessageIndex].content = content;
    } else {
      // Add new system message at the beginning
      this.messages.unshift({
        role: 'system',
        content,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Reset the conversation history
   */
  public resetConversation(): void {
    const systemMessage = this.messages.find(msg => msg.role === 'system');
    this.messages = [];
    
    if (systemMessage) {
      this.messages.push({
        role: 'system',
        content: systemMessage.content,
        timestamp: Date.now()
      });
    } else {
      this.messages.push({
        role: 'system',
        content: this.config.systemPrompt,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Check if conversation is getting too long and summarize if needed
   */
  private async checkAndSummarizeIfNeeded(): Promise<void> {
    // Skip if we don't have many messages yet
    if (this.messages.length < this.config.maxMessages) {
      return;
    }

    try {
      // Get user-assistant exchanges (excluding system message)
      const conversationHistory = this.messages.filter(msg => msg.role !== 'system');
      
      // Prepare for summarization
      logger.info('Conversation getting long, generating summary...');
      
      // Create summarization prompt
      const summarizationMessages = [
        {
          role: 'system' as const,
          content: 'You are a helpful assistant that summarizes conversations. Create a concise summary of the key points and context from the conversation history. Focus on product details, user preferences, and specific requirements mentioned.'
        },
        {
          role: 'user' as const,
          content: `Please summarize the following conversation, preserving all important context needed for continuing the discussion about generating product advertisements:\n\n${
            conversationHistory.map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n\n')
          }`
        }
      ];

      // Generate summary using OpenAI
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: summarizationMessages,
        temperature: 0.3, // Lower temperature for more factual summary
        max_tokens: 500
      });

      const summary = response.choices[0].message.content || "Conversation summary unavailable.";
      
      // Keep only the system message and last 2 exchanges
      const systemMessage = this.messages.find(msg => msg.role === 'system');
      const recentMessages = this.messages.slice(-4); // Keep last 2 exchanges (2 user, 2 assistant messages)
      
      // Reset conversation with summary
      this.messages = [];
      
      // Add back system message
      if (systemMessage) {
        this.messages.push(systemMessage);
      }
      
      // Add summary as a system message
      this.messages.push({
        role: 'system',
        content: `Previous conversation summary: ${summary}`,
        timestamp: Date.now()
      });
      
      // Add recent messages back
      this.messages.push(...recentMessages);
      
      logger.info('Conversation successfully summarized');
    } catch (error) {
      logger.error('Error summarizing conversation:', error);
      // If summarization fails, just trim the older messages
      const systemMessages = this.messages.filter(msg => msg.role === 'system');
      const nonSystemMessages = this.messages.filter(msg => msg.role !== 'system');
      
      // Keep only the 6 most recent non-system messages
      const recentMessages = nonSystemMessages.slice(-6);
      
      // Rebuild the conversation
      this.messages = [...systemMessages, ...recentMessages];
    }
  }

  /**
   * Estimate token count for current conversation (rough approximation)
   * Note: This is a simplified estimation - for accurate counts, use a proper tokenizer
   */
  public estimateTokenCount(): number {
    // Very rough approximation: ~4 characters per token
    return this.messages.reduce((total, msg) => {
      return total + Math.ceil((msg.content.length + msg.role.length) / 4);
    }, 0);
  }

  /**
   * Save the current conversation state
   */
  public serialize(): string {
    return JSON.stringify(this.messages);
  }

  /**
   * Restore a saved conversation state
   */
  public deserialize(serialized: string): void {
    try {
      this.messages = JSON.parse(serialized);
    } catch (error) {
      logger.error('Error deserializing conversation:', error);
      this.resetConversation();
    }
  }
}

/**
 * Helper function to create a conversation manager with the default API key
 */
export function createConversationManager(config?: Partial<ConversationConfig>): ConversationManager {
  if (!process.env.OPENAI_API_KEY) {
    logger.error('OPENAI_API_KEY environment variable is not set');
    throw new Error('OpenAI API key is required to manage conversations');
  }
  
  return new ConversationManager(process.env.OPENAI_API_KEY, config);
} 