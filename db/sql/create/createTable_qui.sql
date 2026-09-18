-- Table: public.qui

-- DROP TABLE IF EXISTS public.qui;

CREATE TABLE IF NOT EXISTS public.qui
(
    id integer PRIMARY KEY
    ,nom character varying(50) NOT NULL
    ,prenom character varying(50) 
    ,fullname character varying(50) 
    ,genre character varying(1)
    ,domaine character varying(50) 
    ,pays character varying(50) 
    ,style character varying(50) 
    ,remarque character varying(5000) 
    ,modifts character varying(20) 
    ,datenaiss_aaaa integer
    ,datenaiss_mm integer
    ,datenaiss_jj integer
    ,datedeces_aaaa integer
    ,datedeces_mm integer
    ,datedeces_jj integer
    ,lienDisk character varying(100)
    ,lienWeb character varying(100)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.qui
    OWNER to postgres;
