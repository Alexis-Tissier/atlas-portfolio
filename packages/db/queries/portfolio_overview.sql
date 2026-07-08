-- Portfolio overview query for manual SQLite checks.

SELECT
  'cash' AS source,
  a.name AS label,
  a.cash_balance AS value
FROM accounts a
WHERE a.include_in_net_worth = 1

UNION ALL

SELECT
  s.asset_class AS source,
  s.name AS label,
  p.quantity * p.current_price AS value
FROM positions p
JOIN securities s ON s.id = p.security_id

ORDER BY value DESC;
