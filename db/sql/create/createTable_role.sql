-- Table: public.role

-- DROP TABLE IF EXISTS public.role;

CREATE TABLE IF NOT EXISTS public.role
(
    id integer PRIMARY KEY
    ,nom character varying(50) 
    ,modifts character varying(20)
    ,id_qui integer
    ,id_quoi integer
    ,remarque character varying(100)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.role
    OWNER to postgres;
