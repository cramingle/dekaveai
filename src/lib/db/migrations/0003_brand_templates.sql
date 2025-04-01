-- Create brand_templates table
CREATE TABLE IF NOT EXISTS brand_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  profile JSONB NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index on name for faster lookups
CREATE INDEX IF NOT EXISTS idx_brand_templates_name ON brand_templates(name);

-- Create index on is_default for faster default template lookups
CREATE INDEX IF NOT EXISTS idx_brand_templates_is_default ON brand_templates(is_default); 