
-- Add metadata columns to document_embeddings table for better tracking
ALTER TABLE public.document_embeddings 
ADD COLUMN page_number INTEGER,
ADD COLUMN line_start INTEGER,
ADD COLUMN line_end INTEGER,
ADD COLUMN metadata JSONB DEFAULT '{}';

-- Create index on page_number for faster page-based queries
CREATE INDEX idx_document_embeddings_page_number ON public.document_embeddings(page_number);

-- Create index on metadata for JSON queries
CREATE INDEX idx_document_embeddings_metadata ON public.document_embeddings USING GIN(metadata);
