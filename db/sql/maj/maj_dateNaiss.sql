## alter table
ALTER TABLE public.qui ADD COLUMN datenaiss_aaaa integer;
ALTER TABLE public.qui ADD COLUMN datenaiss_mm integer;
ALTER TABLE public.qui ADD COLUMN datenaiss_jj integer;

UPDATE public.qui
SET datenaiss_aaaa = SUBSTRING(datenaiss FROM 1 FOR 4)::INTEGER
WHERE datenaiss >'0';