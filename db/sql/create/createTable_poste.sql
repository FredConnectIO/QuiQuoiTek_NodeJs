-- Table: public.poste

-- DROP TABLE IF EXISTS public.poste;

CREATE TABLE IF NOT EXISTS public.poste
(
    id integer PRIMARY KEY
    ,descr character varying(100)
    ,modifts character varying(20)
    ,id_qui_element integer
    ,id_qui_ensemble integer
)
TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.poste
    OWNER to postgres;
