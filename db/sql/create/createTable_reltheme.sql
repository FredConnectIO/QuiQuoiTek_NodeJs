-- Table: public.reltheme

-- DROP TABLE IF EXISTS public.reltheme;

CREATE TABLE IF NOT EXISTS public.reltheme
(
    id integer PRIMARY KEY
    ,nom character varying(50)  
    ,modifts character varying(20)
    ,id_theme integer
    ,id_qui integer
    ,id_quoi integer
    ,id_role integer
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.reltheme
    OWNER to postgres;
