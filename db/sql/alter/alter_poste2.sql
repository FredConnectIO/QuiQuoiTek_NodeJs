-- Renomme la colonne id_quiensemble en id_qui_ensemble dans la table public.poste
ALTER TABLE public.poste
  RENAME COLUMN id_qui TO id_qui_element;
