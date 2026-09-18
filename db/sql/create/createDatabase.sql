-- Database: quiquoitekdb

-- DROP DATABASE IF EXISTS quiquoitekdb;

-- non testé (quiquoitekdb créé via pgAdmin4)
CREATE DATABASE quiquoitekdb
    WITH
    OWNER = postgres
    ENCODING = 'UTF8'
    LC_COLLATE = 'French_France.1252'
    LC_CTYPE = 'French_France.1252'
    LOCALE_PROVIDER = 'libc'
    TABLESPACE = pg_default
    CONNECTION LIMIT = -1
    IS_TEMPLATE = False;