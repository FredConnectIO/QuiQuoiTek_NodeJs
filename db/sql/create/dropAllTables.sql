-- supprime toutes les tables 
-- mode opératoire:
--   cd db/sql
--   node runsql.js dropAllTables.sql

DROP TABLE IF EXISTS public.qui;
DROP TABLE IF EXISTS public.quoi;
DROP TABLE IF EXISTS public.poste;
DROP TABLE IF EXISTS public.role;
DROP TABLE IF EXISTS public.theme;
DROP TABLE IF EXISTS public.reltheme;
DROP TABLE IF EXISTS public.parametre;
