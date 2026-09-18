-- Table: public.theme

-- DROP TABLE IF EXISTS public.theme;

CREATE TABLE IF NOT EXISTS public.theme
(
    id integer PRIMARY KEY
    ,nom character varying(50) NOT NULL 
    ,modifts character varying(20)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.theme
    OWNER to postgres;
