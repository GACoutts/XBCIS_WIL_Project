-- Create tblQuoteDocuments table for quote document attachments
-- Run this script after creating tblQuotes table
-- Stores PDFs and images attached to contractor quotes

USE Rawson;

CREATE TABLE IF NOT EXISTS tblQuoteDocuments (
  DocumentID INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Unique document identifier',
  QuoteID INT NOT NULL COMMENT 'Associated quote',
  DocumentType ENUM('PDF','Image') NOT NULL COMMENT 'Type of document',
  DocumentURL VARCHAR(255) NOT NULL COMMENT 'URL or path to document file',
  UploadedAt DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'When document was uploaded',

  -- Foreign key constraints
  FOREIGN KEY (QuoteID) REFERENCES tblQuotes(QuoteID)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Document attachments for contractor quotes';

-- Create indexes for better performance
CREATE INDEX idx_quote_documents_quote ON tblQuoteDocuments (QuoteID);
CREATE INDEX idx_quote_documents_type ON tblQuoteDocuments (DocumentType);
CREATE INDEX idx_quote_documents_uploaded ON tblQuoteDocuments (UploadedAt);

-- Verify table structure
DESCRIBE tblQuoteDocuments;
