-- Table: public.quoi

-- DROP TABLE IF EXISTS public.quoi;

CREATE TABLE IF NOT EXISTS public.quoi
(
    id integer PRIMARY KEY,
    nom character varying(100) NOT NULL,
    genre character varying(50),
    pays character varying(50) ,
    domaine character varying(50) ,
    stock character varying(50) ,
    qualif character varying(10) ,
    remarque character varying(5000) ,
    datedernierevisu date ,
    date_aaaa bigint,
    date_mm integer,
    date_jj integer,
    modifts character varying(20)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.quoi
    OWNER to postgres;
