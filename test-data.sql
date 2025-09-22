-- Insertar algunos jugadores de prueba
INSERT INTO players (name) VALUES 
  ('Jugador Dev 1'),
  ('Jugador Dev 2'),
  ('Jugador Dev 3'),
  ('Lugones'),
  ('Frenkel');

-- Insertar algunos partidos de prueba
INSERT INTO matches (winner_id, loser_id, score, date) VALUES 
  (1, 2, '6-4 / 6-2', '2025-09-20'),
  (3, 4, '6-3 / 6-1', '2025-09-21'),
  (5, 1, '6-2 / 6-4', '2025-09-22');
