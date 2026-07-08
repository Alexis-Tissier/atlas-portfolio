use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::env;
use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

#[derive(Debug, Serialize, Clone)]
struct DbAccount {
    id: String,
    name: String,
    account_type: String,
    cash_balance: f64,
    include_in_net_worth: bool,
}

#[derive(Debug, Serialize)]
struct PortfolioOverviewRow {
    source: String,
    label: String,
    value: f64,
}

#[derive(Debug, Serialize)]
struct DashboardSummary {
    total: f64,
    performance_amount: f64,
    performance_percent: f64,
    start_date: String,
}

#[derive(Debug, Serialize)]
struct DashboardPosition {
    asset: String,
    category: String,
    account: String,
    quantity: f64,
    value: f64,
    weight: f64,
    performance_percent: f64,
}

#[derive(Debug, Serialize)]
struct DashboardAllocation {
    bucket: String,
    target_percent: f64,
    value: f64,
    actual_percent: f64,
    difference_percent: f64,
}

#[derive(Debug, Serialize)]
struct DashboardAccount {
    id: String,
    name: String,
    account_type: String,
    cash_balance: f64,
    positions_value: f64,
    total_value: f64,
    weight: f64,
}

#[derive(Debug, Serialize)]
struct DashboardData {
    summary: DashboardSummary,
    positions: Vec<DashboardPosition>,
    allocation: Vec<DashboardAllocation>,
    accounts: Vec<DashboardAccount>,
}

#[derive(Debug, Serialize)]
struct DbTransaction {
    id: String,
    date: String,
    transaction_type: String,
    account_name: Option<String>,
    from_account_name: Option<String>,
    to_account_name: Option<String>,
    security_name: Option<String>,
    amount: f64,
    quantity: Option<f64>,
    price: Option<f64>,
    fees: f64,
    note: Option<String>,
}

#[derive(Debug, Serialize)]
struct DbSecurity {
    id: String,
    name: String,
    ticker: String,
    asset_class: String,
    current_price: f64,
}

#[derive(Debug, Serialize)]
struct OnlineAssetSearchResult {
    symbol: String,
    name: String,
    asset_class: String,
    region: String,
    currency: String,
    source: String,
    match_score: f64,
}

#[derive(Debug, Deserialize)]
struct NewOnlineSecurity {
    symbol: String,
    name: String,
    asset_class: String,
    currency: String,
    region: Option<String>,
}

#[derive(Debug, Deserialize)]
struct NewCashTransaction {
    transaction_type: String,
    date: String,
    from_account_id: Option<String>,
    to_account_id: Option<String>,
    amount: f64,
    note: Option<String>,
}

#[derive(Debug, Deserialize)]
struct NewTradeTransaction {
    transaction_type: String,
    date: String,
    account_id: String,
    security_id: String,
    quantity: f64,
    price: f64,
    fees: f64,
    note: Option<String>,
}

#[derive(Debug, Deserialize)]
struct NewSecurityInput {
    name: String,
    ticker: String,
    asset_class: String,
    currency: String,
    current_price: f64,
}

#[derive(Debug)]
struct RawPosition {
    asset: String,
    category: String,
    account_id: String,
    account_name: String,
    quantity: f64,
    value: f64,
    cost: f64,
}

fn database_path() -> Result<PathBuf, String> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let repo_root = manifest_dir
        .join("../../..")
        .canonicalize()
        .map_err(|error| format!("Impossible de trouver la racine du projet : {error}"))?;

    let db_path = repo_root.join(".local").join("atlas-dev.sqlite");

    if !db_path.exists() {
        return Err(format!(
            "Base SQLite introuvable : {}. Lance d'abord ./scripts/create-dev-db.sh depuis la racine du projet.",
            db_path.display()
        ));
    }

    Ok(db_path)
}

fn open_database() -> Result<Connection, String> {
    let path = database_path()?;
    Connection::open(path).map_err(|error| format!("Impossible d'ouvrir SQLite : {error}"))
}

fn alpha_vantage_api_key() -> Result<String, String> {
    env::var("ATLAS_ALPHA_VANTAGE_API_KEY").map_err(|_| {
        "Clé Alpha Vantage manquante. Lance d'abord : export ATLAS_ALPHA_VANTAGE_API_KEY=\"ta_cle\"".to_string()
    })
}

fn alpha_vantage_request(parameters: &[(&str, String)]) -> Result<Value, String> {
    let api_key = alpha_vantage_api_key()?;
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(12))
        .build()
        .map_err(|error| format!("Impossible de créer le client HTTP : {error}"))?;

    let mut request = client
        .get("https://www.alphavantage.co/query")
        .query(&[("apikey", api_key.as_str())]);

    for (name, value) in parameters {
        request = request.query(&[(*name, value.as_str())]);
    }

    let response = request
        .send()
        .map_err(|error| format!("Erreur réseau Alpha Vantage : {error}"))?
        .error_for_status()
        .map_err(|error| format!("Erreur HTTP Alpha Vantage : {error}"))?;

    let json = response
        .json::<Value>()
        .map_err(|error| format!("Réponse Alpha Vantage illisible : {error}"))?;

    if let Some(note) = json.get("Note").and_then(Value::as_str) {
        return Err(format!("Limite Alpha Vantage atteinte : {note}"));
    }

    if let Some(info) = json.get("Information").and_then(Value::as_str) {
        return Err(format!("Alpha Vantage : {info}"));
    }

    if let Some(error_message) = json.get("Error Message").and_then(Value::as_str) {
        return Err(format!("Alpha Vantage : {error_message}"));
    }

    Ok(json)
}

fn alpha_asset_class(alpha_type: &str) -> String {
    match alpha_type.to_lowercase().as_str() {
        value if value.contains("etf") => "ETF".to_string(),
        value if value.contains("crypto") || value.contains("digital") => "Crypto".to_string(),
        _ => "Actions".to_string(),
    }
}

fn sanitize_security_id(symbol: &str, now: u128) -> String {
    let cleaned = symbol
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() {
                character.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .to_string();

    format!("sec-online-{cleaned}-{now}")
}

fn fetch_latest_price(symbol: &str) -> Result<f64, String> {
    let json = alpha_vantage_request(&[
        ("function", "GLOBAL_QUOTE".to_string()),
        ("symbol", symbol.trim().to_string()),
    ])?;

    let quote = json
        .get("Global Quote")
        .and_then(Value::as_object)
        .ok_or_else(|| "Alpha Vantage n'a pas renvoyé de cotation pour ce symbole.".to_string())?;

    let price_text = quote
        .get("05. price")
        .and_then(Value::as_str)
        .ok_or_else(|| "Prix absent de la réponse Alpha Vantage.".to_string())?;

    price_text
        .parse::<f64>()
        .map_err(|error| format!("Prix Alpha Vantage invalide ({price_text}) : {error}"))
}

fn read_security_by_id(connection: &Connection, security_id: &str) -> Result<DbSecurity, String> {
    connection
        .query_row(
            "
            SELECT
              s.id,
              s.name,
              s.ticker,
              s.asset_class,
              COALESCE(
                (
                  SELECT p.close_price
                  FROM prices p
                  WHERE p.security_id = s.id
                  ORDER BY p.date DESC, p.created_at DESC
                  LIMIT 1
                ),
                (
                  SELECT pos.current_price
                  FROM positions pos
                  WHERE pos.security_id = s.id
                  ORDER BY pos.updated_at DESC
                  LIMIT 1
                ),
                0
              ) AS current_price
            FROM securities s
            WHERE s.id = ?1
            ",
            params![security_id],
            |row| {
                Ok(DbSecurity {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    ticker: row.get(2)?,
                    asset_class: row.get(3)?,
                    current_price: row.get(4)?,
                })
            },
        )
        .map_err(|error| format!("Erreur lecture actif {security_id} : {error}"))
}

fn read_accounts(connection: &Connection) -> Result<Vec<DbAccount>, String> {
    let mut statement = connection
        .prepare(
            "
            SELECT
              id,
              name,
              type AS account_type,
              cash_balance,
              include_in_net_worth
            FROM accounts
            ORDER BY
              CASE type
                WHEN 'current_account' THEN 1
                WHEN 'pea' THEN 2
                WHEN 'cto' THEN 3
                WHEN 'livret_a' THEN 4
                WHEN 'crypto_wallet' THEN 5
                ELSE 99
              END
            ",
        )
        .map_err(|error| format!("Erreur SQL accounts : {error}"))?;

    let rows = statement
        .query_map([], |row| {
            Ok(DbAccount {
                id: row.get(0)?,
                name: row.get(1)?,
                account_type: row.get(2)?,
                cash_balance: row.get(3)?,
                include_in_net_worth: row.get::<_, i64>(4)? == 1,
            })
        })
        .map_err(|error| format!("Erreur lecture accounts : {error}"))?;

    let mut accounts = Vec::new();

    for row in rows {
        accounts.push(row.map_err(|error| format!("Erreur conversion account : {error}"))?);
    }

    Ok(accounts)
}

fn read_raw_positions(connection: &Connection) -> Result<Vec<RawPosition>, String> {
    let mut statement = connection
        .prepare(
            "
            SELECT
              s.name,
              s.asset_class,
              a.id,
              a.name,
              p.quantity,
              p.quantity * p.current_price AS value,
              p.quantity * p.average_price AS cost
            FROM positions p
            JOIN securities s ON s.id = p.security_id
            JOIN accounts a ON a.id = p.account_id
            ORDER BY value DESC
            ",
        )
        .map_err(|error| format!("Erreur SQL positions : {error}"))?;

    let rows = statement
        .query_map([], |row| {
            Ok(RawPosition {
                asset: row.get(0)?,
                category: row.get(1)?,
                account_id: row.get(2)?,
                account_name: row.get(3)?,
                quantity: row.get(4)?,
                value: row.get(5)?,
                cost: row.get(6)?,
            })
        })
        .map_err(|error| format!("Erreur lecture positions : {error}"))?;

    let mut positions = Vec::new();

    for row in rows {
        positions.push(row.map_err(|error| format!("Erreur conversion position : {error}"))?);
    }

    Ok(positions)
}

fn update_account_cash(
    transaction: &rusqlite::Transaction,
    account_id: &str,
    amount_delta: f64,
) -> Result<(), String> {
    let changed = transaction
        .execute(
            "
            UPDATE accounts
            SET cash_balance = cash_balance + ?1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?2
            ",
            params![amount_delta, account_id],
        )
        .map_err(|error| format!("Erreur mise à jour cash account {account_id} : {error}"))?;

    if changed != 1 {
        return Err(format!("Compte introuvable : {account_id}"));
    }

    Ok(())
}

#[tauri::command]
fn get_accounts() -> Result<Vec<DbAccount>, String> {
    let connection = open_database()?;
    read_accounts(&connection)
}

#[tauri::command]
fn get_portfolio_overview() -> Result<Vec<PortfolioOverviewRow>, String> {
    let connection = open_database()?;

    let query = "
        SELECT source, label, value
        FROM (
          SELECT
            s.asset_class AS source,
            s.name AS label,
            p.quantity * p.current_price AS value
          FROM positions p
          JOIN securities s ON s.id = p.security_id

          UNION ALL

          SELECT
            'cash' AS source,
            name AS label,
            cash_balance AS value
          FROM accounts
          WHERE include_in_net_worth = 1
        )
        ORDER BY value DESC
    ";

    let mut statement = connection
        .prepare(query)
        .map_err(|error| format!("Erreur SQL portfolio overview : {error}"))?;

    let rows = statement
        .query_map([], |row| {
            Ok(PortfolioOverviewRow {
                source: row.get(0)?,
                label: row.get(1)?,
                value: row.get(2)?,
            })
        })
        .map_err(|error| format!("Erreur lecture portfolio overview : {error}"))?;

    let mut overview = Vec::new();

    for row in rows {
        overview.push(row.map_err(|error| format!("Erreur conversion overview : {error}"))?);
    }

    Ok(overview)
}

#[tauri::command]
fn get_dashboard_data() -> Result<DashboardData, String> {
    let connection = open_database()?;
    let accounts = read_accounts(&connection)?;
    let raw_positions = read_raw_positions(&connection)?;

    let cash_total = accounts
        .iter()
        .filter(|account| account.include_in_net_worth)
        .map(|account| account.cash_balance)
        .sum::<f64>();

    let positions_total = raw_positions
        .iter()
        .map(|position| position.value)
        .sum::<f64>();

    let positions_cost = raw_positions
        .iter()
        .map(|position| position.cost)
        .sum::<f64>();

    let total = cash_total + positions_total;
    let performance_amount = positions_total - positions_cost;
    let performance_percent = if positions_cost > 0.0 {
        (performance_amount / positions_cost) * 100.0
    } else {
        0.0
    };

    let positions = raw_positions
        .iter()
        .map(|position| DashboardPosition {
            asset: position.asset.clone(),
            category: position.category.clone(),
            account: position.account_name.clone(),
            quantity: position.quantity,
            value: position.value,
            weight: if total > 0.0 { (position.value / total) * 100.0 } else { 0.0 },
            performance_percent: if position.cost > 0.0 {
                ((position.value - position.cost) / position.cost) * 100.0
            } else {
                0.0
            },
        })
        .collect::<Vec<_>>();

    let mut allocation_values = HashMap::from([
        ("ETF".to_string(), 0.0),
        ("Actions".to_string(), 0.0),
        ("Crypto".to_string(), 0.0),
        ("Cash".to_string(), cash_total),
    ]);

    for position in &raw_positions {
        *allocation_values.entry(position.category.clone()).or_insert(0.0) += position.value;
    }

    let mut statement = connection
        .prepare(
            "
            SELECT bucket, target_percent
            FROM allocation_targets
            ORDER BY
              CASE bucket
                WHEN 'ETF' THEN 1
                WHEN 'Actions' THEN 2
                WHEN 'Crypto' THEN 3
                WHEN 'Cash' THEN 4
                ELSE 99
              END
            ",
        )
        .map_err(|error| format!("Erreur SQL allocation_targets : {error}"))?;

    let allocation_rows = statement
        .query_map([], |row| {
            let bucket: String = row.get(0)?;
            let target_percent: f64 = row.get(1)?;
            let value = *allocation_values.get(&bucket).unwrap_or(&0.0);
            let actual_percent = if total > 0.0 { (value / total) * 100.0 } else { 0.0 };

            Ok(DashboardAllocation {
                bucket,
                target_percent,
                value,
                actual_percent,
                difference_percent: actual_percent - target_percent,
            })
        })
        .map_err(|error| format!("Erreur lecture allocation_targets : {error}"))?;

    let mut allocation = Vec::new();

    for row in allocation_rows {
        allocation.push(row.map_err(|error| format!("Erreur conversion allocation : {error}"))?);
    }

    let mut positions_by_account = HashMap::<String, f64>::new();

    for position in &raw_positions {
        *positions_by_account.entry(position.account_id.clone()).or_insert(0.0) += position.value;
    }

    let dashboard_accounts = accounts
        .iter()
        .map(|account| {
            let positions_value = *positions_by_account.get(&account.id).unwrap_or(&0.0);
            let total_value = account.cash_balance + positions_value;

            DashboardAccount {
                id: account.id.clone(),
                name: account.name.clone(),
                account_type: account.account_type.clone(),
                cash_balance: account.cash_balance,
                positions_value,
                total_value,
                weight: if total > 0.0 { (total_value / total) * 100.0 } else { 0.0 },
            }
        })
        .collect::<Vec<_>>();

    Ok(DashboardData {
        summary: DashboardSummary {
            total,
            performance_amount,
            performance_percent,
            start_date: "12 janv. 2024".to_string(),
        },
        positions,
        allocation,
        accounts: dashboard_accounts,
    })
}

#[tauri::command]
fn get_transactions() -> Result<Vec<DbTransaction>, String> {
    let connection = open_database()?;

    let mut statement = connection
        .prepare(
            "
            SELECT
              t.id,
              t.date,
              t.type,
              a.name AS account_name,
              from_account.name AS from_account_name,
              to_account.name AS to_account_name,
              s.name AS security_name,
              t.amount,
              t.quantity,
              t.price,
              t.fees,
              t.note
            FROM transactions t
            LEFT JOIN accounts a ON a.id = t.account_id
            LEFT JOIN accounts from_account ON from_account.id = t.from_account_id
            LEFT JOIN accounts to_account ON to_account.id = t.to_account_id
            LEFT JOIN securities s ON s.id = t.security_id
            ORDER BY t.date DESC, t.created_at DESC
            ",
        )
        .map_err(|error| format!("Erreur SQL transactions : {error}"))?;

    let rows = statement
        .query_map([], |row| {
            Ok(DbTransaction {
                id: row.get(0)?,
                date: row.get(1)?,
                transaction_type: row.get(2)?,
                account_name: row.get(3)?,
                from_account_name: row.get(4)?,
                to_account_name: row.get(5)?,
                security_name: row.get(6)?,
                amount: row.get(7)?,
                quantity: row.get(8)?,
                price: row.get(9)?,
                fees: row.get(10)?,
                note: row.get(11)?,
            })
        })
        .map_err(|error| format!("Erreur lecture transactions : {error}"))?;

    let mut transactions = Vec::new();

    for row in rows {
        transactions.push(row.map_err(|error| format!("Erreur conversion transaction : {error}"))?);
    }

    Ok(transactions)
}

#[tauri::command]
fn get_securities() -> Result<Vec<DbSecurity>, String> {
    let connection = open_database()?;

    let mut statement = connection
        .prepare(
            "
            SELECT
              s.id,
              s.name,
              s.ticker,
              s.asset_class,
              COALESCE(
                (
                  SELECT p.close_price
                  FROM prices p
                  WHERE p.security_id = s.id
                  ORDER BY p.date DESC, p.created_at DESC
                  LIMIT 1
                ),
                (
                  SELECT pos.current_price
                  FROM positions pos
                  WHERE pos.security_id = s.id
                  ORDER BY pos.updated_at DESC
                  LIMIT 1
                ),
                0
              ) AS current_price
            FROM securities s
            ORDER BY
              CASE s.asset_class
                WHEN 'ETF' THEN 1
                WHEN 'Actions' THEN 2
                WHEN 'Crypto' THEN 3
                WHEN 'Cash' THEN 4
                ELSE 99
              END,
              s.name
            ",
        )
        .map_err(|error| format!("Erreur SQL securities : {error}"))?;

    let rows = statement
        .query_map([], |row| {
            Ok(DbSecurity {
                id: row.get(0)?,
                name: row.get(1)?,
                ticker: row.get(2)?,
                asset_class: row.get(3)?,
                current_price: row.get(4)?,
            })
        })
        .map_err(|error| format!("Erreur lecture securities : {error}"))?;

    let mut securities = Vec::new();

    for row in rows {
        securities.push(row.map_err(|error| format!("Erreur conversion security : {error}"))?);
    }

    Ok(securities)
}

#[tauri::command]
fn create_security(input: NewSecurityInput) -> Result<DbSecurity, String> {
    let name = input.name.trim();
    let ticker = input.ticker.trim().to_uppercase();
    let asset_class = input.asset_class.trim();
    let currency = input.currency.trim().to_uppercase();

    if name.is_empty() {
        return Err("Le nom de l'actif est obligatoire.".to_string());
    }

    if ticker.is_empty() {
        return Err("Le ticker est obligatoire.".to_string());
    }

    if !matches!(asset_class, "ETF" | "Actions" | "Crypto" | "Cash") {
        return Err("Classe d'actif invalide. Choisis ETF, Actions, Crypto ou Cash.".to_string());
    }

    if currency.is_empty() {
        return Err("La devise est obligatoire.".to_string());
    }

    if input.current_price <= 0.0 {
        return Err("Le cours doit être supérieur à 0.".to_string());
    }

    let mut connection = open_database()?;

    let duplicate = connection
        .query_row(
            "
            SELECT id
            FROM securities
            WHERE lower(ticker) = lower(?1)
               OR lower(name) = lower(?2)
            LIMIT 1
            ",
            params![ticker, name],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| format!("Erreur recherche doublon actif : {error}"))?;

    if duplicate.is_some() {
        return Err("Un actif avec ce nom ou ce ticker existe déjà.".to_string());
    }

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("Erreur horloge système : {error}"))?
        .as_millis();

    let safe_ticker = ticker
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() {
                character.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect::<String>();

    let id = format!("sec-manual-{safe_ticker}-{now}");

    let sqlite_transaction = connection
        .transaction()
        .map_err(|error| format!("Impossible de démarrer la transaction SQLite : {error}"))?;

    sqlite_transaction
        .execute(
            "
            INSERT INTO securities (
              id,
              name,
              ticker,
              isin,
              asset_class,
              sector,
              country,
              currency
            )
            VALUES (?1, ?2, ?3, NULL, ?4, NULL, NULL, ?5)
            ",
            params![id, name, ticker, asset_class, currency],
        )
        .map_err(|error| format!("Erreur création actif : {error}"))?;

    sqlite_transaction
        .execute(
            "
            INSERT INTO prices (
              security_id,
              date,
              close_price,
              currency,
              source
            )
            VALUES (?1, date('now'), ?2, ?3, 'manual')
            ",
            params![id, input.current_price, currency],
        )
        .map_err(|error| format!("Erreur création cours initial : {error}"))?;

    sqlite_transaction
        .commit()
        .map_err(|error| format!("Erreur validation SQLite : {error}"))?;

    Ok(DbSecurity {
        id,
        name: name.to_string(),
        ticker,
        asset_class: asset_class.to_string(),
        current_price: input.current_price,
    })
}

#[tauri::command]
fn search_online_assets(query: String) -> Result<Vec<OnlineAssetSearchResult>, String> {
    let query = query.trim();

    if query.len() < 2 {
        return Err("Tape au moins 2 caractères pour lancer la recherche.".to_string());
    }

    let json = alpha_vantage_request(&[
        ("function", "SYMBOL_SEARCH".to_string()),
        ("keywords", query.to_string()),
    ])?;

    let matches = json
        .get("bestMatches")
        .and_then(Value::as_array)
        .ok_or_else(|| "Alpha Vantage n'a renvoyé aucun résultat exploitable.".to_string())?;

    let results = matches
        .iter()
        .take(12)
        .filter_map(|item| {
            let symbol = item.get("1. symbol")?.as_str()?.trim().to_string();
            let name = item.get("2. name")?.as_str()?.trim().to_string();
            let alpha_type = item.get("3. type").and_then(Value::as_str).unwrap_or("Equity");
            let region = item.get("4. region").and_then(Value::as_str).unwrap_or("—").trim().to_string();
            let currency = item.get("8. currency").and_then(Value::as_str).unwrap_or("EUR").trim().to_string();
            let match_score = item
                .get("9. matchScore")
                .and_then(Value::as_str)
                .and_then(|value| value.parse::<f64>().ok())
                .unwrap_or(0.0);

            Some(OnlineAssetSearchResult {
                symbol,
                name,
                asset_class: alpha_asset_class(alpha_type),
                region,
                currency,
                source: "alpha_vantage".to_string(),
                match_score,
            })
        })
        .collect::<Vec<_>>();

    Ok(results)
}

#[tauri::command]
fn create_security_from_online_result(input: NewOnlineSecurity) -> Result<DbSecurity, String> {
    let symbol = input.symbol.trim().to_string();
    let name = input.name.trim().to_string();
    let asset_class = input.asset_class.trim().to_string();
    let currency = input.currency.trim().to_string();

    if symbol.is_empty() {
        return Err("Le symbole est obligatoire.".to_string());
    }

    if name.is_empty() {
        return Err("Le nom de l'actif est obligatoire.".to_string());
    }

    if !matches!(asset_class.as_str(), "ETF" | "Actions" | "Crypto" | "Cash") {
        return Err("Classe d'actif invalide.".to_string());
    }

    let latest_price = fetch_latest_price(&symbol)?;

    let mut connection = open_database()?;
    let existing_security_id = connection
        .query_row(
            "SELECT id FROM securities WHERE UPPER(ticker) = UPPER(?1) LIMIT 1",
            params![symbol],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| format!("Erreur recherche actif existant : {error}"))?;

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("Erreur horloge système : {error}"))?
        .as_millis();

    let security_id = existing_security_id.unwrap_or_else(|| sanitize_security_id(&symbol, now));
    let region = input.region.filter(|value| !value.trim().is_empty());

    let sqlite_transaction = connection
        .transaction()
        .map_err(|error| format!("Impossible de démarrer la transaction SQLite : {error}"))?;

    sqlite_transaction
        .execute(
            "
            INSERT INTO securities (id, name, ticker, asset_class, country, currency)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              ticker = excluded.ticker,
              asset_class = excluded.asset_class,
              country = excluded.country,
              currency = excluded.currency,
              updated_at = CURRENT_TIMESTAMP
            ",
            params![security_id, name, symbol, asset_class, region, currency],
        )
        .map_err(|error| format!("Erreur création actif : {error}"))?;

    sqlite_transaction
        .execute(
            "
            INSERT INTO prices (security_id, date, close_price, currency, source)
            VALUES (?1, date('now'), ?2, ?3, 'alpha_vantage')
            ON CONFLICT(security_id, date, source) DO UPDATE SET
              close_price = excluded.close_price,
              currency = excluded.currency
            ",
            params![security_id, latest_price, currency],
        )
        .map_err(|error| format!("Erreur enregistrement du cours : {error}"))?;

    sqlite_transaction
        .execute(
            "
            UPDATE positions
            SET current_price = ?1,
                updated_at = CURRENT_TIMESTAMP
            WHERE security_id = ?2
            ",
            params![latest_price, security_id],
        )
        .map_err(|error| format!("Erreur mise à jour positions existantes : {error}"))?;

    sqlite_transaction
        .commit()
        .map_err(|error| format!("Erreur validation SQLite : {error}"))?;

    read_security_by_id(&connection, &security_id)
}

#[tauri::command]
fn create_trade_transaction(input: NewTradeTransaction) -> Result<String, String> {
    if input.date.trim().is_empty() {
        return Err("La date est obligatoire.".to_string());
    }

    if !matches!(input.transaction_type.as_str(), "buy" | "sell") {
        return Err("Cette commande accepte uniquement achat et vente.".to_string());
    }

    if input.account_id.trim().is_empty() {
        return Err("Le compte est obligatoire.".to_string());
    }

    if input.security_id.trim().is_empty() {
        return Err("L'actif est obligatoire.".to_string());
    }

    if input.quantity <= 0.0 {
        return Err("La quantité doit être supérieure à 0.".to_string());
    }

    if input.price <= 0.0 {
        return Err("Le prix unitaire doit être supérieur à 0.".to_string());
    }

    if input.fees < 0.0 {
        return Err("Les frais ne peuvent pas être négatifs.".to_string());
    }

    let gross_amount = input.quantity * input.price;
    let mut connection = open_database()?;
    let sqlite_transaction = connection
        .transaction()
        .map_err(|error| format!("Impossible de démarrer la transaction SQLite : {error}"))?;

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("Erreur horloge système : {error}"))?
        .as_millis();

    let id = format!("tx-trade-{now}");
    let note = input.note.filter(|value| !value.trim().is_empty());

    match input.transaction_type.as_str() {
        "buy" => {
            update_account_cash(&sqlite_transaction, &input.account_id, -(gross_amount + input.fees))?;

            let existing_position = sqlite_transaction
                .query_row(
                    "
                    SELECT id, quantity, average_price, current_price
                    FROM positions
                    WHERE account_id = ?1 AND security_id = ?2
                    ",
                    params![input.account_id, input.security_id],
                    |row| Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, f64>(1)?,
                        row.get::<_, f64>(2)?,
                        row.get::<_, f64>(3)?,
                    )),
                )
                .optional()
                .map_err(|error| format!("Erreur recherche position : {error}"))?;

            if let Some((position_id, old_quantity, old_average_price, old_current_price)) = existing_position {
                let old_cost = old_quantity * old_average_price;
                let new_quantity = old_quantity + input.quantity;
                let new_average_price = (old_cost + gross_amount + input.fees) / new_quantity;

                // Important : le prix saisi dans une transaction d'achat est le prix d'exécution.
                // Il ne doit pas remplacer le dernier cours connu, sinon tout l'historique de la position
                // est revalorisé au prix de l'ordre et le patrimoine part en vrille.
                sqlite_transaction
                    .execute(
                        "
                        UPDATE positions
                        SET quantity = ?1,
                            average_price = ?2,
                            current_price = ?3,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?4
                        ",
                        params![new_quantity, new_average_price, old_current_price, position_id],
                    )
                    .map_err(|error| format!("Erreur mise à jour position : {error}"))?;
            } else {
                let position_id = format!("pos-{now}");
                let average_price = (gross_amount + input.fees) / input.quantity;

                sqlite_transaction
                    .execute(
                        "
                        INSERT INTO positions (
                          id,
                          account_id,
                          security_id,
                          quantity,
                          average_price,
                          current_price
                        )
                        VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                        ",
                        params![position_id, input.account_id, input.security_id, input.quantity, average_price, input.price],
                    )
                    .map_err(|error| format!("Erreur création position : {error}"))?;
            }
        }
        "sell" => {
            let existing_position = sqlite_transaction
                .query_row(
                    "
                    SELECT id, quantity, average_price, current_price
                    FROM positions
                    WHERE account_id = ?1 AND security_id = ?2
                    ",
                    params![input.account_id, input.security_id],
                    |row| Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, f64>(1)?,
                        row.get::<_, f64>(2)?,
                        row.get::<_, f64>(3)?,
                    )),
                )
                .optional()
                .map_err(|error| format!("Erreur recherche position : {error}"))?;

            let Some((position_id, old_quantity, old_average_price, old_current_price)) = existing_position else {
                return Err("Impossible de vendre : aucune position existante pour cet actif dans ce compte.".to_string());
            };

            if input.quantity > old_quantity + 0.0000001 {
                return Err(format!(
                    "Quantité insuffisante : position actuelle {old_quantity:.4}, vente demandée {requested:.4}.",
                    requested = input.quantity
                ));
            }

            let new_quantity = old_quantity - input.quantity;

            if new_quantity <= 0.0000001 {
                sqlite_transaction
                    .execute("DELETE FROM positions WHERE id = ?1", params![position_id])
                    .map_err(|error| format!("Erreur suppression position : {error}"))?;
            } else {
                sqlite_transaction
                    .execute(
                        "
                        UPDATE positions
                        SET quantity = ?1,
                            average_price = ?2,
                            current_price = ?3,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?4
                        ",
                        params![new_quantity, old_average_price, old_current_price, position_id],
                    )
                    .map_err(|error| format!("Erreur réduction position : {error}"))?;
            }

            update_account_cash(&sqlite_transaction, &input.account_id, gross_amount - input.fees)?;
        }
        _ => unreachable!(),
    }

    sqlite_transaction
        .execute(
            "
            INSERT INTO transactions (
              id,
              date,
              type,
              from_account_id,
              to_account_id,
              account_id,
              security_id,
              quantity,
              price,
              fees,
              amount,
              note
            )
            VALUES (?1, ?2, ?3, NULL, NULL, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
            ",
            params![
                id,
                input.date,
                input.transaction_type,
                input.account_id,
                input.security_id,
                input.quantity,
                input.price,
                input.fees,
                gross_amount,
                note
            ],
        )
        .map_err(|error| format!("Erreur insertion transaction achat/vente : {error}"))?;

    sqlite_transaction
        .commit()
        .map_err(|error| format!("Erreur validation SQLite : {error}"))?;

    Ok(id)
}

#[tauri::command]
fn create_cash_transaction(input: NewCashTransaction) -> Result<String, String> {
    if input.date.trim().is_empty() {
        return Err("La date est obligatoire.".to_string());
    }

    if input.amount <= 0.0 {
        return Err("Le montant doit être supérieur à 0.".to_string());
    }

    let transaction_type = input.transaction_type.as_str();

    if !matches!(transaction_type, "deposit" | "withdrawal" | "transfer") {
        return Err("Cette première version accepte uniquement dépôt, retrait et transfert.".to_string());
    }

    let mut connection = open_database()?;
    let sqlite_transaction = connection
        .transaction()
        .map_err(|error| format!("Impossible de démarrer la transaction SQLite : {error}"))?;

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("Erreur horloge système : {error}"))?
        .as_millis();

    let id = format!("tx-cash-{now}");
    let note = input.note.filter(|value| !value.trim().is_empty());

    let (from_account_id, to_account_id, account_id) = match transaction_type {
        "deposit" => {
            let to_account_id = input
                .to_account_id
                .clone()
                .ok_or_else(|| "Compte de destination obligatoire pour un dépôt.".to_string())?;

            update_account_cash(&sqlite_transaction, &to_account_id, input.amount)?;

            (None, Some(to_account_id.clone()), Some(to_account_id))
        }
        "withdrawal" => {
            let from_account_id = input
                .from_account_id
                .clone()
                .ok_or_else(|| "Compte source obligatoire pour un retrait.".to_string())?;

            update_account_cash(&sqlite_transaction, &from_account_id, -input.amount)?;

            (Some(from_account_id.clone()), None, Some(from_account_id))
        }
        "transfer" => {
            let from_account_id = input
                .from_account_id
                .clone()
                .ok_or_else(|| "Compte source obligatoire pour un transfert.".to_string())?;
            let to_account_id = input
                .to_account_id
                .clone()
                .ok_or_else(|| "Compte de destination obligatoire pour un transfert.".to_string())?;

            if from_account_id == to_account_id {
                return Err("Le compte source et le compte de destination doivent être différents.".to_string());
            }

            update_account_cash(&sqlite_transaction, &from_account_id, -input.amount)?;
            update_account_cash(&sqlite_transaction, &to_account_id, input.amount)?;

            (Some(from_account_id), Some(to_account_id), None)
        }
        _ => unreachable!(),
    };

    sqlite_transaction
        .execute(
            "
            INSERT INTO transactions (
              id,
              date,
              type,
              from_account_id,
              to_account_id,
              account_id,
              security_id,
              quantity,
              price,
              fees,
              amount,
              note
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL, NULL, NULL, 0, ?7, ?8)
            ",
            params![
                id,
                input.date,
                transaction_type,
                from_account_id,
                to_account_id,
                account_id,
                input.amount,
                note
            ],
        )
        .map_err(|error| format!("Erreur insertion transaction : {error}"))?;

    sqlite_transaction
        .commit()
        .map_err(|error| format!("Erreur validation SQLite : {error}"))?;

    Ok(id)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_accounts,
            get_portfolio_overview,
            get_dashboard_data,
            get_transactions,
            get_securities,
            create_security,
            create_cash_transaction,
            create_trade_transaction
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
