-- Table: public.parametre

-- DROP TABLE IF EXISTS public.parametre;

CREATE TABLE IF NOT EXISTS public.parametre
(
    id integer PRIMARY KEY
    ,nom character varying(50) NOT NULL 
    ,niv1 character varying(1000)
    ,modifts character varying(20)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.parametre
    OWNER to postgres;
