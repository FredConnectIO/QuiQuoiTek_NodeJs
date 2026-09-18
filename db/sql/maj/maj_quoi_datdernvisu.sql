-- Efface datedernierevisu pour les enregistrements antérieurs à 2000-01-01
UPDATE quoi
SET datedernierevisu = NULL
WHERE datedernierevisu < DATE '2000-01-01';
