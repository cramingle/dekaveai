import { db } from './index';
import { brandTemplates } from './schema';

const initialTemplates = [
  {
    name: 'sportsDrink',
    profile: {
      brand_style_profile: {
        messaging_style: "energetic, motivational, performance-focused",
        typography: "bold, sans-serif, dynamic",
        color_scheme: "vibrant blues, energetic reds, and clean whites",
        product_placement: "action shots, prominently featured",
        layout_structure: "dynamic, asymmetrical with strong movement"
      }
    },
    isDefault: true
  },
  {
    name: 'luxuryFashion',
    profile: {
      brand_style_profile: {
        messaging_style: "sophisticated, exclusive, aspirational",
        typography: "elegant, serif, refined",
        color_scheme: "monochromatic, gold accents, muted tones",
        product_placement: "minimalistic, artistic, center-stage",
        layout_structure: "balanced, generous whitespace, geometric"
      }
    },
    isDefault: false
  },
  {
    name: 'organicFood',
    profile: {
      brand_style_profile: {
        messaging_style: "authentic, wholesome, sustainable",
        typography: "friendly, natural, approachable",
        color_scheme: "earthy greens, warm browns, natural palette",
        product_placement: "ingredient-focused, context-rich, lifestyle",
        layout_structure: "clean, organized, with natural elements"
      }
    },
    isDefault: false
  }
];

export async function seedBrandTemplates() {
  try {
    console.log('Starting to seed brand templates...');

    // Insert templates one by one, handling conflicts
    for (const template of initialTemplates) {
      await db.insert(brandTemplates)
        .values(template)
        .onConflictDoUpdate({
          target: brandTemplates.name,
          set: {
            profile: template.profile,
            isDefault: template.isDefault,
            updatedAt: new Date()
          }
        });
    }

    console.log('Successfully seeded brand templates');
  } catch (error) {
    console.error('Error seeding brand templates:', error);
    throw error;
  }
} 