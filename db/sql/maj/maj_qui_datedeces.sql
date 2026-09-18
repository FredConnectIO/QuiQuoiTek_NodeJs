-- Remplir les colonnes datedeces_aaaa/mm/jj à partir de la chaîne datedeces (format attendu AAAA-MM-JJ)
UPDATE public.qui
SET
    datedeces_aaaa = NULLIF(SPLIT_PART(TRIM(datedeces), '-', 1), '')::integer,
    datedeces_mm   = NULLIF(SPLIT_PART(TRIM(datedeces), '-', 2), '')::integer,
    datedeces_jj   = NULLIF(SPLIT_PART(TRIM(datedeces), '-', 3), '')::integer
WHERE datedeces IS NOT NULL
  AND datedeces <> '';
