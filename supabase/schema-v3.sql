-- OpenPod Schema v3 Migration
-- Run after schema-v2.sql in Supabase SQL Editor
-- Adds: github_repo column to projects

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS github_repo text;
