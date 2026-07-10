use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::env;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

#[derive(Debug, Serialize, Clone)]
struct DbAccount {
    id: String,
    name: String,
    account_type: String,
    currency: String,
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
struct DashboardSnapshot {
    date: String,
    total_value: f64,
    invested_capital: Option<f64>,
    performance_amount: Option<f64>,
    performance_percent: Option<f64>,
}

#[derive(Debug, Serialize)]
struct DashboardAccount {
    id: String,
    name: String,
    account_type: String,
    currency: String,
    cash_balance: f64,
    positions_value: f64,
    total_value: f64,
    weight: f64,
    include_in_net_worth: bool,
}

#[derive(Debug, Serialize)]
struct DashboardData {
    summary: DashboardSummary,
    positions: Vec<DashboardPosition>,
    allocation: Vec<DashboardAllocation>,
    accounts: Vec<DashboardAccount>,
    snapshots: Vec<DashboardSnapshot>,
}

#[derive(Debug, Serialize)]
struct DbTransaction {
    id: String,
    date: String,
    transaction_type: String,
    account_id: Option<String>,
    from_account_id: Option<String>,
    to_account_id: Option<String>,
    security_id: Option<String>,
    account_name: Option<String>,
    from_account_name: Option<String>,
    to_account_name: Option<String>,
    security_name: Option<String>,
    security_ticker: Option<String>,
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

#[derive(Debug, Serialize)]
struct OnlineAssetHistoryPoint {
    timestamp: i64,
    close: f64,
}

#[derive(Debug, Serialize)]
struct OnlineAssetHistory {
    symbol: String,
    currency: String,
    source: String,
    used_symbol: String,
    current_price: f64,
    points: Vec<OnlineAssetHistoryPoint>,
}

#[derive(Debug, Serialize)]
struct OnlineAssetQuote {
    symbol: String,
    price: f64,
    source: String,
    used_symbol: String,
}

#[derive(Debug, Deserialize)]
struct NewOnlineSecurity {
    symbol: String,
    name: String,
    asset_class: String,
    currency: String,
    region: Option<String>,
}

#[derive(Debug, Serialize)]
struct PriceUpdateLine {
    security_id: String,
    name: String,
    ticker: String,
    used_symbol: String,
    old_price: f64,
    new_price: f64,
    source: String,
}
#[derive(Debug, Serialize)]
struct PriceUpdateError {
    security_id: String,
    name: String,
    ticker: String,
    used_symbol: String,
    message: String,
}
#[derive(Debug, Serialize)]
struct PriceUpdateSummary {
    updated_at: String,
    updated_count: usize,
    skipped_count: usize,
    error_count: usize,
    updated: Vec<PriceUpdateLine>,
    errors: Vec<PriceUpdateError>,
}

#[derive(Debug, Serialize)]
struct PositionPageRow {
    position_id: String,
    account_id: String,
    security_id: String,
    account_name: String,
    security_name: String,
    ticker: String,
    asset_class: String,
    quantity: f64,
    average_price: f64,
    current_price: f64,
    price_source: String,
    price_date: Option<String>,
    last_price_symbol: String,
    price_error: Option<String>,
    value: f64,
    cost: f64,
    performance_amount: f64,
    performance_percent: f64,
    price_warning: Option<String>,
}
#[derive(Debug)]

struct PriceQuote {
    price: f64,
    source: String,
    used_symbol: String,
}
struct OpenSecurityForPriceUpdate {
    id: String,
    name: String,
    ticker: String,
    asset_class: String,
    old_price: f64,
}
#[derive(Debug, Deserialize)]
struct NewCashTransaction {
    transaction_type: String,
    date: String,
    from_account_id: Option<String>,
    to_account_id: Option<String>,
    security_id: Option<String>,
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
struct UpdateTransactionInput {
    id: String,
    transaction_type: String,
    date: String,
    account_id: Option<String>,
    from_account_id: Option<String>,
    to_account_id: Option<String>,
    security_id: Option<String>,
    amount: Option<f64>,
    quantity: Option<f64>,
    price: Option<f64>,
    fees: Option<f64>,
    note: Option<String>,
}

#[derive(Debug, Clone)]
struct StoredTransaction {
    id: String,
    date: String,
    transaction_type: String,
    from_account_id: Option<String>,
    to_account_id: Option<String>,
    account_id: Option<String>,
    security_id: Option<String>,
    quantity: Option<f64>,
    price: Option<f64>,
    fees: f64,
    amount: f64,
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

#[derive(Debug, Deserialize)]
struct NewAccountInput {
    name: String,
    account_type: String,
    currency: String,
    initial_cash: f64,
    opening_date: String,
    include_in_net_worth: bool,
}

#[derive(Debug, Deserialize)]
struct UpdateAccountInput {
    id: String,
    name: String,
    account_type: String,
    currency: String,
    include_in_net_worth: bool,
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
    include_in_net_worth: bool,
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

fn ensure_flexible_account_types(connection: &Connection) -> Result<(), String> {
    let table_sql = connection
        .query_row(
            "
            SELECT sql
            FROM sqlite_master
            WHERE type = 'table' AND name = 'accounts'
            ",
            [],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| format!("Erreur lecture schéma accounts : {error}"))?;

    let Some(table_sql) = table_sql else {
        return Ok(());
    };

    if !table_sql.to_lowercase().contains("check") {
        return Ok(());
    }

    connection
        .execute_batch(
            "
            PRAGMA foreign_keys = OFF;

            BEGIN IMMEDIATE;

            CREATE TABLE accounts_atlas_migrated (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              type TEXT NOT NULL,
              currency TEXT NOT NULL DEFAULT 'EUR',
              cash_balance REAL NOT NULL DEFAULT 0,
              include_in_net_worth INTEGER NOT NULL DEFAULT 1,
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            INSERT INTO accounts_atlas_migrated (
              id,
              name,
              type,
              currency,
              cash_balance,
              include_in_net_worth,
              created_at,
              updated_at
            )
            SELECT
              id,
              name,
              type,
              currency,
              cash_balance,
              include_in_net_worth,
              created_at,
              updated_at
            FROM accounts;

            DROP TABLE accounts;

            ALTER TABLE accounts_atlas_migrated
            RENAME TO accounts;

            COMMIT;

            PRAGMA foreign_keys = ON;
            ",
        )
        .map_err(|error| {
            let _ = connection.execute_batch(
                "
                ROLLBACK;
                PRAGMA foreign_keys = ON;
                ",
            );

            format!("Erreur migration des types de comptes : {error}")
        })?;

    Ok(())
}

fn open_database() -> Result<Connection, String> {
    let path = database_path()?;
    let connection =
        Connection::open(path).map_err(|error| format!("Impossible d'ouvrir SQLite : {error}"))?;

    ensure_flexible_account_types(&connection)?;

    Ok(connection)
}

fn alpha_vantage_api_key() -> Result<String, String> {
    if let Ok(value) = env::var("ATLAS_ALPHA_VANTAGE_API_KEY") {
        let trimmed = value.trim().to_string();
        if !trimmed.is_empty() {
            return Ok(trimmed);
        }
    }

    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let repo_root = manifest_dir
        .join("../../..")
        .canonicalize()
        .map_err(|error| format!("Impossible de trouver la racine du projet : {error}"))?;
    let config_path = repo_root.join(".local").join("atlas-config.json");

    if config_path.exists() {
        let content = std::fs::read_to_string(&config_path)
            .map_err(|error| format!("Impossible de lire {} : {error}", config_path.display()))?;
        let json: Value = serde_json::from_str(&content)
            .map_err(|error| format!("Configuration Alpha Vantage invalide : {error}"))?;

        let key = json
            .get("alpha_vantage_api_key")
            .or_else(|| json.get("alphaVantageApiKey"))
            .and_then(Value::as_str)
            .unwrap_or("")
            .trim()
            .to_string();

        if !key.is_empty() {
            return Ok(key);
        }
    }

    Err(
        "Clé Alpha Vantage manquante. Mets-la dans .local/atlas-config.json avec { \"alpha_vantage_api_key\": \"ta_cle\" } ou lance export ATLAS_ALPHA_VANTAGE_API_KEY=\"ta_cle\"."
            .to_string(),
    )
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

fn fetch_latest_price_from_alpha_vantage(symbol: &str) -> Result<f64, String> {
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

fn yahoo_history_range(period: &str) -> (&'static str, &'static str) {
    match period.trim().to_uppercase().as_str() {
        "1M" => ("1mo", "1d"),
        "6M" => ("6mo", "1d"),
        "1A" | "1Y" => ("1y", "1d"),
        "5A" | "5Y" => ("5y", "1wk"),
        "MAX" | "TOUS" => ("max", "1mo"),
        _ => ("6mo", "1d"),
    }
}

fn fetch_history_from_yahoo_symbol(
    symbol: &str,
    period: &str,
) -> Result<OnlineAssetHistory, String> {
    let symbol = symbol.trim();

    if symbol.is_empty() {
        return Err("Symbole Yahoo vide.".to_string());
    }

    let (range, interval) = yahoo_history_range(period);

    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(12))
        .build()
        .map_err(|error| format!("Impossible de créer le client HTTP Yahoo : {error}"))?;

    let json = client
        .get(format!(
            "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
        ))
        .header(
            "User-Agent",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
        )
        .header("Accept", "application/json,text/plain,*/*")
        .query(&[("range", range), ("interval", interval)])
        .send()
        .map_err(|error| format!("Erreur réseau Yahoo Finance : {error}"))?
        .error_for_status()
        .map_err(|error| format!("Erreur HTTP Yahoo Finance : {error}"))?
        .json::<Value>()
        .map_err(|error| format!("Réponse Yahoo Finance illisible : {error}"))?;

    let chart = json
        .get("chart")
        .and_then(Value::as_object)
        .ok_or_else(|| "Yahoo Finance n'a pas renvoyé de bloc chart.".to_string())?;

    if let Some(error_value) = chart.get("error") {
        if !error_value.is_null() {
            return Err(format!("Yahoo Finance : {error_value}"));
        }
    }

    let result = chart
        .get("result")
        .and_then(Value::as_array)
        .and_then(|items| items.first())
        .ok_or_else(|| "Yahoo Finance n'a pas renvoyé de résultat exploitable.".to_string())?;

    let currency = result
        .get("meta")
        .and_then(|meta| meta.get("currency"))
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();

    let timestamps = result
        .get("timestamp")
        .and_then(Value::as_array)
        .ok_or_else(|| "Yahoo Finance n'a pas renvoyé de dates historiques.".to_string())?;

    let close_values = result
        .get("indicators")
        .and_then(|indicators| indicators.get("quote"))
        .and_then(Value::as_array)
        .and_then(|quotes| quotes.first())
        .and_then(|quote| quote.get("close"))
        .and_then(Value::as_array)
        .ok_or_else(|| "Yahoo Finance n'a pas renvoyé de cours historiques.".to_string())?;

    let mut points = Vec::new();

    for (timestamp_value, close_value) in timestamps.iter().zip(close_values.iter()) {
        let Some(timestamp) = timestamp_value.as_i64() else {
            continue;
        };

        let Some(close) = close_value.as_f64() else {
            continue;
        };

        if close > 0.0 {
            points.push(OnlineAssetHistoryPoint { timestamp, close });
        }
    }

    if points.is_empty() {
        return Err("Yahoo Finance n'a renvoyé aucun point historique exploitable.".to_string());
    }

    let fallback_price = points.last().map(|point| point.close).unwrap_or(0.0);
    let current_price = result
        .get("meta")
        .and_then(|meta| meta.get("regularMarketPrice"))
        .and_then(Value::as_f64)
        .filter(|value| *value > 0.0)
        .unwrap_or(fallback_price);

    Ok(OnlineAssetHistory {
        symbol: symbol.to_string(),
        currency,
        source: "yahoo".to_string(),
        used_symbol: symbol.to_string(),
        current_price,
        points,
    })
}

fn fetch_latest_price_from_yahoo(symbol: &str) -> Result<f64, String> {
    let symbol = symbol.trim();

    if symbol.is_empty() {
        return Err("Symbole Yahoo vide.".to_string());
    }

    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(12))
        .build()
        .map_err(|error| format!("Impossible de créer le client HTTP Yahoo : {error}"))?;

    let json = client
        .get(format!(
            "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
        ))
        .header(
            "User-Agent",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
        )
        .header("Accept", "application/json,text/plain,*/*")
        .query(&[("range", "1d"), ("interval", "1d")])
        .send()
        .map_err(|error| format!("Erreur réseau Yahoo Finance : {error}"))?
        .error_for_status()
        .map_err(|error| format!("Erreur HTTP Yahoo Finance : {error}"))?
        .json::<Value>()
        .map_err(|error| format!("Réponse Yahoo Finance illisible : {error}"))?;

    let chart = json
        .get("chart")
        .and_then(Value::as_object)
        .ok_or_else(|| "Yahoo Finance n'a pas renvoyé de bloc chart.".to_string())?;

    if let Some(error_value) = chart.get("error") {
        if !error_value.is_null() {
            return Err(format!("Yahoo Finance : {error_value}"));
        }
    }

    let result = chart
        .get("result")
        .and_then(Value::as_array)
        .and_then(|items| items.first())
        .ok_or_else(|| "Yahoo Finance n'a pas renvoyé de résultat exploitable.".to_string())?;

    if let Some(price) = result
        .get("meta")
        .and_then(|meta| meta.get("regularMarketPrice"))
        .and_then(Value::as_f64)
        .filter(|value| *value > 0.0)
    {
        return Ok(price);
    }

    let close_values = result
        .get("indicators")
        .and_then(|indicators| indicators.get("quote"))
        .and_then(Value::as_array)
        .and_then(|quotes| quotes.first())
        .and_then(|quote| quote.get("close"))
        .and_then(Value::as_array)
        .ok_or_else(|| "Yahoo Finance n'a pas renvoyé de dernier cours.".to_string())?;

    close_values
        .iter()
        .rev()
        .filter_map(Value::as_f64)
        .find(|value| *value > 0.0)
        .ok_or_else(|| "Yahoo Finance n'a pas renvoyé de cours positif.".to_string())
}

fn yahoo_symbol_candidates(symbol: &str) -> Vec<String> {
    let trimmed = symbol.trim();
    let upper = trimmed.to_uppercase();
    let mut candidates = Vec::new();

    if !trimmed.is_empty() {
        candidates.push(trimmed.to_string());
    }

    if upper.ends_with(".PAR") {
        candidates.push(format!("{}{}", &trimmed[..trimmed.len() - 4], ".PA"));
    }

    if upper.ends_with(".AMS") {
        candidates.push(format!("{}{}", &trimmed[..trimmed.len() - 4], ".AS"));
    }

    candidates.dedup();
    candidates
}

fn preferred_quote_symbol(symbol: &str) -> String {
    yahoo_symbol_candidates(symbol)
        .first()
        .cloned()
        .unwrap_or_else(|| symbol.trim().to_string())
}

fn preferred_storage_symbol(symbol: &str) -> String {
    let trimmed = symbol.trim();
    let upper = trimmed.to_uppercase();

    if upper.ends_with(".PAR") {
        return format!("{}{}", &trimmed[..trimmed.len() - 4], ".PA");
    }

    if upper.ends_with(".AMS") {
        return format!("{}{}", &trimmed[..trimmed.len() - 4], ".AS");
    }

    trimmed.to_string()
}

fn fetch_latest_price_with_source(symbol: &str) -> Result<PriceQuote, String> {
    let mut yahoo_errors = Vec::new();

    for yahoo_symbol in yahoo_symbol_candidates(symbol) {
        match fetch_latest_price_from_yahoo(&yahoo_symbol) {
            Ok(price) => {
                return Ok(PriceQuote {
                    price,
                    source: "yahoo".to_string(),
                    used_symbol: yahoo_symbol,
                });
            }
            Err(error) => yahoo_errors.push(format!("{yahoo_symbol}: {error}")),
        }
    }

    let alpha_result = fetch_latest_price_from_alpha_vantage(symbol);

    if let Ok(price) = alpha_result {
        return Ok(PriceQuote {
            price,
            source: "alpha_vantage".to_string(),
            used_symbol: symbol.trim().to_string(),
        });
    }

    let alpha_error = alpha_result
        .err()
        .unwrap_or_else(|| "Erreur Alpha Vantage inconnue".to_string());
    let yahoo_error = if yahoo_errors.is_empty() {
        "Erreur Yahoo inconnue".to_string()
    } else {
        yahoo_errors.join(" | ")
    };

    Err(format!(
        "Yahoo Finance indisponible ({yahoo_error}) puis Alpha Vantage indisponible ({alpha_error})"
    ))
}

fn is_suspicious_price_jump(old_price: f64, new_price: f64) -> bool {
    old_price > 0.0 && (new_price > old_price * 3.0 || new_price < old_price / 3.0)
}

fn is_suspicious_price_jump_for_asset(asset_class: &str, old_price: f64, new_price: f64) -> bool {
    if asset_class.eq_ignore_ascii_case("Crypto") {
        return old_price > 0.0 && (new_price > old_price * 10.0 || new_price < old_price / 10.0);
    }

    is_suspicious_price_jump(old_price, new_price)
}

fn ensure_price_update_status_table(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(
            "
            CREATE TABLE IF NOT EXISTS price_update_status (
              security_id TEXT PRIMARY KEY,
              attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              provider TEXT NOT NULL DEFAULT '',
              used_symbol TEXT NOT NULL DEFAULT '',
              status TEXT NOT NULL,
              old_price REAL NOT NULL DEFAULT 0,
              new_price REAL,
              message TEXT,
              FOREIGN KEY (security_id) REFERENCES securities(id) ON DELETE CASCADE
            );
            ",
        )
        .map_err(|error| format!("Erreur création table price_update_status : {error}"))
}

fn upsert_price_update_status(
    connection: &Connection,
    security_id: &str,
    provider: &str,
    used_symbol: &str,
    status: &str,
    old_price: f64,
    new_price: Option<f64>,
    message: Option<&str>,
) -> Result<(), String> {
    ensure_price_update_status_table(connection)?;

    connection
        .execute(
            "
            INSERT INTO price_update_status (
              security_id,
              attempted_at,
              provider,
              used_symbol,
              status,
              old_price,
              new_price,
              message
            )
            VALUES (?1, datetime('now', 'localtime'), ?2, ?3, ?4, ?5, ?6, ?7)
            ON CONFLICT(security_id) DO UPDATE SET
              attempted_at = excluded.attempted_at,
              provider = excluded.provider,
              used_symbol = excluded.used_symbol,
              status = excluded.status,
              old_price = excluded.old_price,
              new_price = excluded.new_price,
              message = excluded.message
            ",
            params![
                security_id,
                provider,
                used_symbol,
                status,
                old_price,
                new_price,
                message
            ],
        )
        .map_err(|error| format!("Erreur enregistrement statut prix {security_id} : {error}"))?;

    Ok(())
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

fn read_account_by_id(connection: &Connection, account_id: &str) -> Result<DbAccount, String> {
    connection
        .query_row(
            "
            SELECT
              id,
              name,
              type AS account_type,
              currency,
              cash_balance,
              include_in_net_worth
            FROM accounts
            WHERE id = ?1
            ",
            params![account_id],
            |row| {
                Ok(DbAccount {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    account_type: row.get(2)?,
                    currency: row.get(3)?,
                    cash_balance: row.get(4)?,
                    include_in_net_worth: row.get::<_, i64>(5)? == 1,
                })
            },
        )
        .map_err(|error| format!("Erreur lecture compte {account_id} : {error}"))
}

fn read_accounts(connection: &Connection) -> Result<Vec<DbAccount>, String> {
    let mut statement = connection
        .prepare(
            "
            SELECT
              id,
              name,
              type AS account_type,
              currency,
              cash_balance,
              include_in_net_worth
            FROM accounts
            ORDER BY
              CASE type
                WHEN 'current_account' THEN 1
                WHEN 'livret_a' THEN 2
                WHEN 'ldds' THEN 3
                WHEN 'pel' THEN 4
                WHEN 'savings_account' THEN 5
                WHEN 'pea' THEN 10
                WHEN 'pea_pme' THEN 11
                WHEN 'cto' THEN 12
                WHEN 'pee' THEN 13
                WHEN 'per' THEN 14
                WHEN 'assurance_vie' THEN 15
                WHEN 'crypto_wallet' THEN 20
                WHEN 'other' THEN 30
                ELSE 99
              END,
              lower(name)
            ",
        )
        .map_err(|error| format!("Erreur SQL accounts : {error}"))?;

    let rows = statement
        .query_map([], |row| {
            Ok(DbAccount {
                id: row.get(0)?,
                name: row.get(1)?,
                account_type: row.get(2)?,
                currency: row.get(3)?,
                cash_balance: row.get(4)?,
                include_in_net_worth: row.get::<_, i64>(5)? == 1,
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
              p.quantity * p.average_price AS cost,
              a.include_in_net_worth,
              (
                SELECT ph.source
                FROM prices ph
                WHERE ph.security_id = s.id
                ORDER BY ph.date DESC, ph.created_at DESC
                LIMIT 1
              ) AS price_source,
              (
                SELECT ph.date
                FROM prices ph
                WHERE ph.security_id = s.id
                ORDER BY ph.date DESC, ph.created_at DESC
                LIMIT 1
              ) AS price_date
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
                include_in_net_worth: row.get::<_, i64>(7)? == 1,
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

fn normalized_account_fields(
    name: &str,
    account_type: &str,
    currency: &str,
) -> Result<(String, String, String), String> {
    let name = name.trim().to_string();
    let account_type = account_type.trim().to_string();
    let currency = currency.trim().to_uppercase();

    if name.is_empty() {
        return Err("Le nom du compte est obligatoire.".to_string());
    }

    if name.chars().count() > 80 {
        return Err("Le nom du compte ne peut pas dépasser 80 caractères.".to_string());
    }

    if !matches!(
        account_type.as_str(),
        "current_account"
            | "pea"
            | "pea_pme"
            | "cto"
            | "pee"
            | "per"
            | "assurance_vie"
            | "livret_a"
            | "ldds"
            | "pel"
            | "savings_account"
            | "crypto_wallet"
            | "other"
    ) {
        return Err("Type de compte invalide.".to_string());
    }

    if currency.len() != 3
        || !currency
            .chars()
            .all(|character| character.is_ascii_alphabetic())
    {
        return Err("La devise doit contenir trois lettres, par exemple EUR.".to_string());
    }

    Ok((name, account_type, currency))
}

fn ensure_unique_account_name(
    connection: &Connection,
    name: &str,
    excluded_account_id: Option<&str>,
) -> Result<(), String> {
    let duplicate = connection
        .query_row(
            "
            SELECT id
            FROM accounts
            WHERE lower(name) = lower(?1)
              AND (?2 IS NULL OR id <> ?2)
            LIMIT 1
            ",
            params![name, excluded_account_id],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| format!("Erreur recherche doublon compte : {error}"))?;

    if duplicate.is_some() {
        return Err("Un compte avec ce nom existe déjà.".to_string());
    }

    Ok(())
}

#[tauri::command]
fn create_account(input: NewAccountInput) -> Result<DbAccount, String> {
    let (name, account_type, currency) =
        normalized_account_fields(&input.name, &input.account_type, &input.currency)?;

    if !input.initial_cash.is_finite() || input.initial_cash < 0.0 {
        return Err("Le cash initial doit être un montant positif ou nul.".to_string());
    }

    let opening_date = input.opening_date.trim().to_string();
    if opening_date.is_empty() {
        return Err("La date d'ouverture est obligatoire.".to_string());
    }

    let mut connection = open_database()?;
    ensure_unique_account_name(&connection, &name, None)?;

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("Erreur horloge système : {error}"))?
        .as_millis();

    let safe_name = name
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

    let account_id = format!(
        "account-{}-{now}",
        if safe_name.is_empty() {
            "nouveau"
        } else {
            &safe_name
        }
    );

    let sqlite_transaction = connection
        .transaction()
        .map_err(|error| format!("Impossible de démarrer la création du compte : {error}"))?;

    sqlite_transaction
        .execute(
            "
            INSERT INTO accounts (
              id,
              name,
              type,
              currency,
              cash_balance,
              include_in_net_worth
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            ",
            params![
                &account_id,
                &name,
                &account_type,
                &currency,
                input.initial_cash,
                if input.include_in_net_worth { 1 } else { 0 }
            ],
        )
        .map_err(|error| format!("Erreur création compte : {error}"))?;

    if input.initial_cash > 0.000001 {
        let transaction_id = format!("tx-opening-cash-{now}");
        let note = format!("Cash initial du compte {name}.");

        sqlite_transaction
            .execute(
                "
                INSERT INTO transactions (
                  id,
                  date,
                  type,
                  account_id,
                  fees,
                  amount,
                  note
                )
                VALUES (?1, ?2, 'opening_cash', ?3, 0, ?4, ?5)
                ",
                params![
                    transaction_id,
                    opening_date,
                    &account_id,
                    input.initial_cash,
                    note
                ],
            )
            .map_err(|error| format!("Erreur création cash initial : {error}"))?;
    }

    sqlite_transaction
        .commit()
        .map_err(|error| format!("Erreur validation du nouveau compte : {error}"))?;

    read_account_by_id(&connection, &account_id)
}

#[tauri::command]
fn update_account(input: UpdateAccountInput) -> Result<DbAccount, String> {
    let account_id = input.id.trim().to_string();
    if account_id.is_empty() {
        return Err("Identifiant de compte obligatoire.".to_string());
    }

    let (name, account_type, currency) =
        normalized_account_fields(&input.name, &input.account_type, &input.currency)?;

    let connection = open_database()?;
    read_account_by_id(&connection, &account_id)?;
    ensure_unique_account_name(&connection, &name, Some(&account_id))?;

    let changed = connection
        .execute(
            "
            UPDATE accounts
            SET name = ?1,
                type = ?2,
                currency = ?3,
                include_in_net_worth = ?4,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?5
            ",
            params![
                name,
                account_type,
                currency,
                if input.include_in_net_worth { 1 } else { 0 },
                account_id
            ],
        )
        .map_err(|error| format!("Erreur modification compte : {error}"))?;

    if changed != 1 {
        return Err("Compte introuvable.".to_string());
    }

    read_account_by_id(&connection, &input.id)
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
          JOIN accounts a ON a.id = p.account_id
          WHERE a.include_in_net_worth = 1

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
        .filter(|position| position.include_in_net_worth)
        .map(|position| position.value)
        .sum::<f64>();

    let positions_cost = raw_positions
        .iter()
        .filter(|position| position.include_in_net_worth)
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
        .filter(|position| position.include_in_net_worth)
        .map(|position| DashboardPosition {
            asset: position.asset.clone(),
            category: position.category.clone(),
            account: position.account_name.clone(),
            quantity: position.quantity,
            value: position.value,
            weight: if total > 0.0 {
                (position.value / total) * 100.0
            } else {
                0.0
            },
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
        if position.include_in_net_worth {
            *allocation_values
                .entry(position.category.clone())
                .or_insert(0.0) += position.value;
        }
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
            let actual_percent = if total > 0.0 {
                (value / total) * 100.0
            } else {
                0.0
            };

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
        *positions_by_account
            .entry(position.account_id.clone())
            .or_insert(0.0) += position.value;
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
                currency: account.currency.clone(),
                cash_balance: account.cash_balance,
                positions_value,
                total_value,
                weight: if account.include_in_net_worth && total > 0.0 {
                    (total_value / total) * 100.0
                } else {
                    0.0
                },
                include_in_net_worth: account.include_in_net_worth,
            }
        })
        .collect::<Vec<_>>();

    let mut snapshot_statement = connection
        .prepare(
            "
            SELECT
              date,
              total_value,
              invested_capital,
              performance_amount,
              performance_percent
            FROM portfolio_snapshots
            ORDER BY date ASC
            ",
        )
        .map_err(|error| format!("Erreur SQL portfolio_snapshots : {error}"))?;

    let snapshot_rows = snapshot_statement
        .query_map([], |row| {
            Ok(DashboardSnapshot {
                date: row.get(0)?,
                total_value: row.get(1)?,
                invested_capital: row.get(2)?,
                performance_amount: row.get(3)?,
                performance_percent: row.get(4)?,
            })
        })
        .map_err(|error| format!("Erreur lecture portfolio_snapshots : {error}"))?;

    let mut snapshots = Vec::new();

    for row in snapshot_rows {
        snapshots.push(row.map_err(|error| format!("Erreur conversion snapshot : {error}"))?);
    }

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
        snapshots,
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
              t.account_id,
              t.from_account_id,
              t.to_account_id,
              t.security_id,
              a.name AS account_name,
              from_account.name AS from_account_name,
              to_account.name AS to_account_name,
              s.name AS security_name,
              s.ticker AS security_ticker,
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
                account_id: row.get(3)?,
                from_account_id: row.get(4)?,
                to_account_id: row.get(5)?,
                security_id: row.get(6)?,
                account_name: row.get(7)?,
                from_account_name: row.get(8)?,
                to_account_name: row.get(9)?,
                security_name: row.get(10)?,
                security_ticker: row.get(11)?,
                amount: row.get(12)?,
                quantity: row.get(13)?,
                price: row.get(14)?,
                fees: row.get(15)?,
                note: row.get(16)?,
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
fn get_positions_page() -> Result<Vec<PositionPageRow>, String> {
    let connection = open_database()?;
    ensure_price_update_status_table(&connection)?;

    let mut statement = connection
        .prepare(
            "
            SELECT
              p.id,
              a.name AS account_name,
              s.name AS security_name,
              s.ticker,
              s.asset_class,
              p.quantity,
              p.average_price,
              p.current_price,
              p.quantity * p.current_price AS value,
              p.quantity * p.average_price AS cost,
              COALESCE(lp.source, 'manual') AS price_source,
              lp.date AS price_date,
              COALESCE(NULLIF(pus.used_symbol, ''), s.ticker) AS last_price_symbol,
              CASE
                WHEN pus.status IN ('kept', 'error') THEN pus.message
                ELSE NULL
              END AS price_error,
              p.account_id,
              p.security_id
            FROM positions p
            JOIN securities s ON s.id = p.security_id
            JOIN accounts a ON a.id = p.account_id
            LEFT JOIN prices lp ON lp.id = (
              SELECT p2.id
              FROM prices p2
              WHERE p2.security_id = s.id
              ORDER BY p2.date DESC, p2.created_at DESC
              LIMIT 1
            )
            LEFT JOIN price_update_status pus ON pus.security_id = s.id
            WHERE p.quantity > 0
            ORDER BY value DESC
            ",
        )
        .map_err(|error| format!("Erreur SQL page positions : {error}"))?;

    let rows = statement
        .query_map([], |row| {
            let quantity: f64 = row.get(5)?;
            let average_price: f64 = row.get(6)?;
            let current_price: f64 = row.get(7)?;
            let value: f64 = row.get(8)?;
            let cost: f64 = row.get(9)?;
            let price_error: Option<String> = row.get(13)?;
            let performance_amount = value - cost;
            let performance_percent = if cost > 0.0 {
                (performance_amount / cost) * 100.0
            } else {
                0.0
            };

            let price_warning = if let Some(message) = price_error.clone() {
                Some(message)
            } else if current_price <= 0.0 {
                Some("Cours absent ou nul : à vérifier.".to_string())
            } else {
                None
            };

            Ok(PositionPageRow {
                position_id: row.get(0)?,
                account_id: row.get(14)?,
                security_id: row.get(15)?,
                account_name: row.get(1)?,
                security_name: row.get(2)?,
                ticker: row.get(3)?,
                asset_class: row.get(4)?,
                quantity,
                average_price,
                current_price,
                price_source: row.get(10)?,
                price_date: row.get(11)?,
                last_price_symbol: row.get(12)?,
                price_error,
                value,
                cost,
                performance_amount,
                performance_percent,
                price_warning,
            })
        })
        .map_err(|error| format!("Erreur lecture page positions : {error}"))?;

    let mut positions = Vec::new();

    for row in rows {
        positions.push(row.map_err(|error| format!("Erreur conversion page position : {error}"))?);
    }

    Ok(positions)
}

#[tauri::command]
fn search_online_assets(query: String) -> Result<Vec<OnlineAssetSearchResult>, String> {
    let query = query.trim();

    if query.len() < 2 {
        return Err("Tape au moins 2 caractères pour lancer la recherche.".to_string());
    }

    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(12))
        .build()
        .map_err(|error| format!("Impossible de créer le client HTTP Yahoo : {error}"))?;

    let json = client
        .get("https://query1.finance.yahoo.com/v1/finance/search")
        .header(
            "User-Agent",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
        )
        .header("Accept", "application/json,text/plain,*/*")
        .query(&[
            ("q", query),
            ("quotesCount", "12"),
            ("newsCount", "0"),
            ("enableFuzzyQuery", "true"),
        ])
        .send()
        .map_err(|error| format!("Erreur réseau Yahoo Finance : {error}"))?
        .error_for_status()
        .map_err(|error| format!("Erreur HTTP Yahoo Finance : {error}"))?
        .json::<Value>()
        .map_err(|error| format!("Réponse Yahoo Finance illisible : {error}"))?;

    let quotes = json
        .get("quotes")
        .and_then(Value::as_array)
        .ok_or_else(|| "Yahoo Finance n'a renvoyé aucun résultat exploitable.".to_string())?;

    let results = quotes
        .iter()
        .take(12)
        .filter_map(|item| {
            let symbol = item.get("symbol")?.as_str()?.trim().to_string();

            if symbol.is_empty() {
                return None;
            }

            let name = item
                .get("shortname")
                .or_else(|| item.get("longname"))
                .or_else(|| item.get("name"))
                .and_then(Value::as_str)
                .unwrap_or(symbol.as_str())
                .trim()
                .to_string();

            let quote_type = item
                .get("quoteType")
                .and_then(Value::as_str)
                .unwrap_or("")
                .trim();

            let asset_class = match quote_type {
                "ETF" => "ETF",
                "EQUITY" => "Actions",
                "CRYPTOCURRENCY" => "Crypto",
                _ if symbol.ends_with("-EUR") || symbol.ends_with("-USD") => "Crypto",
                _ => "Actions",
            }
            .to_string();

            let region = item
                .get("exchDisp")
                .or_else(|| item.get("exchange"))
                .and_then(Value::as_str)
                .unwrap_or("Yahoo Finance")
                .trim()
                .to_string();

            let currency = item
                .get("currency")
                .and_then(Value::as_str)
                .unwrap_or_else(|| {
                    if symbol.ends_with(".PA")
                        || symbol.ends_with(".AS")
                        || symbol.ends_with("-EUR")
                    {
                        "EUR"
                    } else {
                        "USD"
                    }
                })
                .trim()
                .to_string();

            let match_score = item
                .get("score")
                .or_else(|| item.get("matchScore"))
                .and_then(Value::as_f64)
                .unwrap_or(0.0);

            Some(OnlineAssetSearchResult {
                symbol,
                name,
                asset_class,
                region,
                currency,
                source: "yahoo".to_string(),
                match_score,
            })
        })
        .collect::<Vec<_>>();

    if results.is_empty() {
        return Err("Aucun actif trouvé sur Yahoo Finance.".to_string());
    }

    Ok(results)
}

#[tauri::command]
fn lookup_online_asset_quote(symbol: String) -> Result<OnlineAssetQuote, String> {
    let symbol = preferred_storage_symbol(symbol.trim());

    if symbol.len() < 2 {
        return Err("Tape au moins 2 caractères pour chercher un cours.".to_string());
    }

    let quote = fetch_latest_price_with_source(&symbol)?;

    Ok(OnlineAssetQuote {
        symbol,
        price: quote.price,
        source: quote.source,
        used_symbol: quote.used_symbol,
    })
}

#[tauri::command]
fn lookup_online_asset_history(
    symbol: String,
    period: String,
) -> Result<OnlineAssetHistory, String> {
    let storage_symbol = preferred_storage_symbol(symbol.trim());

    if storage_symbol.len() < 2 {
        return Err("Tape au moins 2 caractères pour ouvrir un graphique.".to_string());
    }

    let mut errors = Vec::new();

    for candidate in yahoo_symbol_candidates(&storage_symbol) {
        match fetch_history_from_yahoo_symbol(&candidate, &period) {
            Ok(mut history) => {
                history.symbol = storage_symbol.clone();
                return Ok(history);
            }
            Err(error) => errors.push(format!("{candidate}: {error}")),
        }
    }

    Err(format!(
        "Impossible de récupérer l'historique Yahoo Finance : {}",
        errors.join(" | ")
    ))
}

#[tauri::command]
fn create_security_from_online_result(input: NewOnlineSecurity) -> Result<DbSecurity, String> {
    let symbol = preferred_storage_symbol(input.symbol.trim());
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

    let latest_quote = fetch_latest_price_with_source(&symbol)?;
    let latest_price = latest_quote.price;

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
            VALUES (?1, date('now'), ?2, ?3, ?4)
            ON CONFLICT(security_id, date, source) DO UPDATE SET
              close_price = excluded.close_price,
              currency = excluded.currency
            ",
            params![security_id, latest_price, currency, latest_quote.source],
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
fn update_open_position_prices() -> Result<PriceUpdateSummary, String> {
    let connection = open_database()?;
    ensure_price_update_status_table(&connection)?;

    let securities = {
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
                  ) AS old_price
                FROM securities s
                WHERE EXISTS (
                  SELECT 1
                  FROM positions p
                  WHERE p.security_id = s.id
                    AND p.quantity > 0
                )
                ORDER BY s.name
                ",
            )
            .map_err(|error| format!("Erreur SQL actifs à mettre à jour : {error}"))?;

        let rows = statement
            .query_map([], |row| {
                Ok(OpenSecurityForPriceUpdate {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    ticker: row.get(2)?,
                    asset_class: row.get(3)?,
                    old_price: row.get(4)?,
                })
            })
            .map_err(|error| format!("Erreur lecture actifs à mettre à jour : {error}"))?;

        let mut securities = Vec::new();

        for row in rows {
            securities.push(
                row.map_err(|error| format!("Erreur conversion actif à mettre à jour : {error}"))?,
            );
        }

        securities
    };

    let mut updated = Vec::new();
    let mut errors = Vec::new();
    let mut skipped_count = 0usize;

    for security in securities {
        if security.ticker.trim().is_empty() {
            let message = "Ticker absent, ancien cours conservé.".to_string();

            upsert_price_update_status(
                &connection,
                &security.id,
                "",
                "",
                "error",
                security.old_price,
                None,
                Some(&message),
            )?;

            skipped_count += 1;
            errors.push(PriceUpdateError {
                security_id: security.id,
                name: security.name,
                ticker: security.ticker,
                used_symbol: "".to_string(),
                message,
            });
            continue;
        }

        match fetch_latest_price_with_source(&security.ticker) {
            Ok(PriceQuote {
                price: new_price,
                source,
                used_symbol,
            }) if new_price > 0.0 => {
                if is_suspicious_price_jump_for_asset(
                    &security.asset_class,
                    security.old_price,
                    new_price,
                ) {
                    let message = format!(
                        "Variation suspecte ignorée : ancien cours {old:.4}, nouveau cours {new:.4} via {source} ({used_symbol}). Ancien cours conservé.",
                        old = security.old_price,
                        new = new_price
                    );

                    upsert_price_update_status(
                        &connection,
                        &security.id,
                        &source,
                        &used_symbol,
                        "kept",
                        security.old_price,
                        Some(new_price),
                        Some(&message),
                    )?;

                    skipped_count += 1;
                    errors.push(PriceUpdateError {
                        security_id: security.id,
                        name: security.name,
                        ticker: security.ticker,
                        used_symbol,
                        message,
                    });
                    continue;
                }

                connection
                    .execute(
                        "
                        INSERT INTO prices (security_id, date, close_price, currency, source)
                        SELECT ?1, date('now'), ?2, currency, ?3
                        FROM securities
                        WHERE id = ?1
                        ON CONFLICT(security_id, date, source) DO UPDATE SET
                          close_price = excluded.close_price,
                          currency = excluded.currency
                        ",
                        params![security.id, new_price, source.as_str()],
                    )
                    .map_err(|error| {
                        format!("Erreur enregistrement cours {} : {error}", security.ticker)
                    })?;

                connection
                    .execute(
                        "
                        UPDATE positions
                        SET current_price = ?1,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE security_id = ?2
                        ",
                        params![new_price, security.id],
                    )
                    .map_err(|error| {
                        format!("Erreur mise à jour positions {} : {error}", security.ticker)
                    })?;

                upsert_price_update_status(
                    &connection,
                    &security.id,
                    &source,
                    &used_symbol,
                    "updated",
                    security.old_price,
                    Some(new_price),
                    None,
                )?;

                updated.push(PriceUpdateLine {
                    security_id: security.id,
                    name: security.name,
                    ticker: security.ticker,
                    used_symbol,
                    old_price: security.old_price,
                    new_price,
                    source,
                });
            }
            Ok(PriceQuote {
                price: new_price,
                source,
                used_symbol,
            }) => {
                let message = format!("Cours invalide reçu ({new_price}) via {source} ({used_symbol}), ancien cours conservé.");

                upsert_price_update_status(
                    &connection,
                    &security.id,
                    &source,
                    &used_symbol,
                    "error",
                    security.old_price,
                    Some(new_price),
                    Some(&message),
                )?;

                skipped_count += 1;
                errors.push(PriceUpdateError {
                    security_id: security.id,
                    name: security.name,
                    ticker: security.ticker,
                    used_symbol,
                    message,
                });
            }
            Err(error) => {
                let used_symbol = preferred_quote_symbol(&security.ticker);
                let message = format!("{error}. Ancien cours conservé.");

                upsert_price_update_status(
                    &connection,
                    &security.id,
                    "",
                    &used_symbol,
                    "error",
                    security.old_price,
                    None,
                    Some(&message),
                )?;

                skipped_count += 1;
                errors.push(PriceUpdateError {
                    security_id: security.id,
                    name: security.name,
                    ticker: security.ticker,
                    used_symbol,
                    message,
                });
            }
        }
    }

    let updated_at = connection
        .query_row("SELECT datetime('now', 'localtime')", [], |row| {
            row.get::<_, String>(0)
        })
        .unwrap_or_else(|_| "maintenant".to_string());

    Ok(PriceUpdateSummary {
        updated_at,
        updated_count: updated.len(),
        skipped_count,
        error_count: errors.len(),
        updated,
        errors,
    })
}

fn read_stored_transaction(
    transaction: &rusqlite::Transaction,
    transaction_id: &str,
) -> Result<StoredTransaction, String> {
    transaction
        .query_row(
            "
            SELECT
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
            FROM transactions
            WHERE id = ?1
            ",
            params![transaction_id],
            |row| {
                Ok(StoredTransaction {
                    id: row.get(0)?,
                    date: row.get(1)?,
                    transaction_type: row.get(2)?,
                    from_account_id: row.get(3)?,
                    to_account_id: row.get(4)?,
                    account_id: row.get(5)?,
                    security_id: row.get(6)?,
                    quantity: row.get(7)?,
                    price: row.get(8)?,
                    fees: row.get(9)?,
                    amount: row.get(10)?,
                    note: row.get(11)?,
                })
            },
        )
        .optional()
        .map_err(|error| format!("Erreur lecture transaction {transaction_id} : {error}"))?
        .ok_or_else(|| format!("Transaction introuvable : {transaction_id}"))
}

fn latest_price_for_security(
    transaction: &rusqlite::Transaction,
    security_id: &str,
    fallback_price: f64,
) -> Result<f64, String> {
    let latest_price = transaction
        .query_row(
            "
            SELECT close_price
            FROM prices
            WHERE security_id = ?1
            ORDER BY date DESC, created_at DESC
            LIMIT 1
            ",
            params![security_id],
            |row| row.get::<_, f64>(0),
        )
        .optional()
        .map_err(|error| format!("Erreur lecture dernier cours {security_id} : {error}"))?;

    Ok(latest_price
        .unwrap_or(fallback_price)
        .max(fallback_price)
        .max(0.0))
}

fn adjust_position_quantity_and_cost(
    transaction: &rusqlite::Transaction,
    account_id: &str,
    security_id: &str,
    quantity_delta: f64,
    cost_delta: f64,
    fallback_price: f64,
) -> Result<(), String> {
    let existing_position = transaction
        .query_row(
            "
            SELECT id, quantity, average_price, current_price
            FROM positions
            WHERE account_id = ?1 AND security_id = ?2
            ",
            params![account_id, security_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, f64>(1)?,
                    row.get::<_, f64>(2)?,
                    row.get::<_, f64>(3)?,
                ))
            },
        )
        .optional()
        .map_err(|error| format!("Erreur lecture position {security_id} : {error}"))?;

    if let Some((position_id, old_quantity, old_average_price, old_current_price)) =
        existing_position
    {
        let new_quantity = old_quantity + quantity_delta;

        if new_quantity <= 0.00000001 {
            transaction
                .execute("DELETE FROM positions WHERE id = ?1", params![position_id])
                .map_err(|error| format!("Erreur suppression position {security_id} : {error}"))?;
            return Ok(());
        }

        let old_cost = old_quantity * old_average_price;
        let new_cost = old_cost + cost_delta;
        let new_average_price = if cost_delta.abs() > 0.00000001 && new_cost > 0.0 {
            new_cost / new_quantity
        } else {
            old_average_price
        };

        let new_current_price = if old_current_price > 0.0 {
            old_current_price
        } else {
            latest_price_for_security(transaction, security_id, fallback_price)?
        };

        transaction
            .execute(
                "
                UPDATE positions
                SET quantity = ?1,
                    average_price = ?2,
                    current_price = ?3,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?4
                ",
                params![
                    new_quantity,
                    new_average_price,
                    new_current_price,
                    position_id
                ],
            )
            .map_err(|error| format!("Erreur mise à jour position {security_id} : {error}"))?;

        return Ok(());
    }

    if quantity_delta <= 0.0 {
        return Ok(());
    }

    let current_price = latest_price_for_security(transaction, security_id, fallback_price)?;
    let average_price = if cost_delta > 0.0 {
        cost_delta / quantity_delta
    } else {
        fallback_price
    };
    let position_id = format!("pos-{account_id}-{security_id}");

    transaction
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
            ON CONFLICT(id) DO UPDATE SET
              quantity = excluded.quantity,
              average_price = excluded.average_price,
              current_price = excluded.current_price,
              updated_at = CURRENT_TIMESTAMP
            ",
            params![
                position_id,
                account_id,
                security_id,
                quantity_delta,
                average_price,
                current_price
            ],
        )
        .map_err(|error| format!("Erreur création position {security_id} : {error}"))?;

    Ok(())
}

fn position_quantity_for_trade(
    transaction: &rusqlite::Transaction,
    account_id: &str,
    security_id: &str,
) -> Result<f64, String> {
    transaction
        .query_row(
            "
            SELECT quantity
            FROM positions
            WHERE account_id = ?1 AND security_id = ?2
            ",
            params![account_id, security_id],
            |row| row.get::<_, f64>(0),
        )
        .optional()
        .map(|quantity| quantity.unwrap_or(0.0))
        .map_err(|error| format!("Erreur lecture quantité disponible {security_id} : {error}"))
}

fn apply_stored_transaction_effect(
    transaction: &rusqlite::Transaction,
    stored: &StoredTransaction,
    sign: f64,
) -> Result<(), String> {
    match stored.transaction_type.as_str() {
        "deposit" => {
            let to_account_id = stored
                .to_account_id
                .as_deref()
                .ok_or_else(|| "Compte destination manquant pour le dépôt.".to_string())?;
            update_account_cash(transaction, to_account_id, sign * stored.amount)?;
        }
        "withdrawal" => {
            let from_account_id = stored
                .from_account_id
                .as_deref()
                .ok_or_else(|| "Compte source manquant pour le retrait.".to_string())?;
            update_account_cash(transaction, from_account_id, -sign * stored.amount)?;
        }
        "transfer" => {
            let from_account_id = stored
                .from_account_id
                .as_deref()
                .ok_or_else(|| "Compte source manquant pour le transfert.".to_string())?;
            let to_account_id = stored
                .to_account_id
                .as_deref()
                .ok_or_else(|| "Compte destination manquant pour le transfert.".to_string())?;
            update_account_cash(transaction, from_account_id, -sign * stored.amount)?;
            update_account_cash(transaction, to_account_id, sign * stored.amount)?;
        }
        "dividend" => {
            let account_id = stored
                .account_id
                .as_deref()
                .or(stored.to_account_id.as_deref())
                .ok_or_else(|| "Compte manquant pour le dividende.".to_string())?;
            update_account_cash(transaction, account_id, sign * stored.amount)?;
        }
        "fee" => {
            let account_id = stored
                .account_id
                .as_deref()
                .or(stored.from_account_id.as_deref())
                .ok_or_else(|| "Compte manquant pour les frais.".to_string())?;
            update_account_cash(transaction, account_id, -sign * stored.amount)?;
        }
        "buy" => {
            let account_id = stored
                .account_id
                .as_deref()
                .ok_or_else(|| "Compte manquant pour l'achat.".to_string())?;
            let security_id = stored
                .security_id
                .as_deref()
                .ok_or_else(|| "Actif manquant pour l'achat.".to_string())?;
            let quantity = stored
                .quantity
                .ok_or_else(|| "Quantité manquante pour l'achat.".to_string())?;
            let price = stored
                .price
                .ok_or_else(|| "Prix manquant pour l'achat.".to_string())?;
            let gross_amount = quantity * price;
            let cash_amount = gross_amount + stored.fees;

            update_account_cash(transaction, account_id, -sign * cash_amount)?;
            adjust_position_quantity_and_cost(
                transaction,
                account_id,
                security_id,
                sign * quantity,
                sign * cash_amount,
                price,
            )?;
        }
        "sell" => {
            let account_id = stored
                .account_id
                .as_deref()
                .ok_or_else(|| "Compte manquant pour la vente.".to_string())?;
            let security_id = stored
                .security_id
                .as_deref()
                .ok_or_else(|| "Actif manquant pour la vente.".to_string())?;
            let quantity = stored
                .quantity
                .ok_or_else(|| "Quantité manquante pour la vente.".to_string())?;
            let price = stored
                .price
                .ok_or_else(|| "Prix manquant pour la vente.".to_string())?;

            if sign > 0.0 {
                let available_quantity =
                    position_quantity_for_trade(transaction, account_id, security_id)?;

                if quantity > available_quantity + 0.0000001 {
                    return Err(format!(
                        "Vente impossible : quantité disponible {available_quantity:.4}, quantité demandée {quantity:.4}."
                    ));
                }
            }

            let gross_amount = quantity * price;
            let cash_amount = gross_amount - stored.fees;

            update_account_cash(transaction, account_id, sign * cash_amount)?;
            adjust_position_quantity_and_cost(
                transaction,
                account_id,
                security_id,
                -sign * quantity,
                0.0,
                price,
            )?;
        }
        "opening_position" | "opening_cash" => {
            // Lignes techniques pour expliquer l'état initial.
            // Elles ne modifient pas l'état actuel : elles servent uniquement au diagnostic/recalcul.
        }
        _ => {
            return Err(format!(
                "Type de transaction non pris en charge : {}",
                stored.transaction_type
            ))
        }
    }

    Ok(())
}

fn stored_transaction_from_update_input(
    input: UpdateTransactionInput,
) -> Result<StoredTransaction, String> {
    let transaction_type = input.transaction_type.trim().to_string();

    if input.id.trim().is_empty() {
        return Err("Identifiant de transaction obligatoire.".to_string());
    }

    if input.date.trim().is_empty() {
        return Err("La date est obligatoire.".to_string());
    }

    if !matches!(
        transaction_type.as_str(),
        "deposit" | "withdrawal" | "transfer" | "buy" | "sell" | "dividend" | "fee"
    ) {
        return Err("Type de transaction invalide.".to_string());
    }

    let fees = input.fees.unwrap_or(0.0);

    if fees < 0.0 {
        return Err("Les frais ne peuvent pas être négatifs.".to_string());
    }

    let amount = match transaction_type.as_str() {
        "deposit" | "withdrawal" | "transfer" | "dividend" | "fee" => {
            let amount = input
                .amount
                .ok_or_else(|| "Montant obligatoire.".to_string())?;
            if amount <= 0.0 {
                return Err("Le montant doit être supérieur à 0.".to_string());
            }
            amount
        }
        "buy" => {
            let quantity = input
                .quantity
                .ok_or_else(|| "Quantité obligatoire.".to_string())?;
            let price = input.price.ok_or_else(|| "Prix obligatoire.".to_string())?;
            if quantity <= 0.0 || price <= 0.0 {
                return Err("Quantité et prix doivent être supérieurs à 0.".to_string());
            }
            quantity * price + fees
        }
        "sell" => {
            let quantity = input
                .quantity
                .ok_or_else(|| "Quantité obligatoire.".to_string())?;
            let price = input.price.ok_or_else(|| "Prix obligatoire.".to_string())?;
            if quantity <= 0.0 || price <= 0.0 {
                return Err("Quantité et prix doivent être supérieurs à 0.".to_string());
            }

            let net_amount = quantity * price - fees;
            if net_amount <= 0.0 {
                return Err("Les frais ne peuvent pas dépasser le montant de la vente.".to_string());
            }

            net_amount
        }
        _ => unreachable!(),
    };

    let mut from_account_id = input
        .from_account_id
        .filter(|value| !value.trim().is_empty());
    let mut to_account_id = input.to_account_id.filter(|value| !value.trim().is_empty());
    let mut account_id = input.account_id.filter(|value| !value.trim().is_empty());
    let security_id = input.security_id.filter(|value| !value.trim().is_empty());

    match transaction_type.as_str() {
        "deposit" => {
            let destination = to_account_id
                .clone()
                .ok_or_else(|| "Compte destination obligatoire pour un dépôt.".to_string())?;
            account_id = Some(destination);
            from_account_id = None;
        }
        "withdrawal" => {
            let source = from_account_id
                .clone()
                .ok_or_else(|| "Compte source obligatoire pour un retrait.".to_string())?;
            account_id = Some(source);
            to_account_id = None;
        }
        "transfer" => {
            if from_account_id.is_none() || to_account_id.is_none() {
                return Err(
                    "Compte source et destination obligatoires pour un transfert.".to_string(),
                );
            }

            if from_account_id == to_account_id {
                return Err(
                    "Le compte source et le compte de destination doivent être différents."
                        .to_string(),
                );
            }

            account_id = None;
        }
        "dividend" => {
            let destination = account_id
                .clone()
                .or_else(|| to_account_id.clone())
                .ok_or_else(|| "Compte obligatoire pour un dividende.".to_string())?;
            account_id = Some(destination.clone());
            to_account_id = Some(destination);
            from_account_id = None;
        }
        "fee" => {
            let source = account_id
                .clone()
                .or_else(|| from_account_id.clone())
                .ok_or_else(|| "Compte obligatoire pour les frais.".to_string())?;
            account_id = Some(source.clone());
            from_account_id = Some(source);
            to_account_id = None;
        }
        "buy" | "sell" => {
            if account_id.is_none() {
                return Err("Compte obligatoire pour un achat ou une vente.".to_string());
            }

            if security_id.is_none() {
                return Err("Actif obligatoire pour un achat ou une vente.".to_string());
            }

            from_account_id = None;
            to_account_id = None;
        }
        _ => unreachable!(),
    }

    Ok(StoredTransaction {
        id: input.id.trim().to_string(),
        date: input.date,
        transaction_type,
        from_account_id,
        to_account_id,
        account_id,
        security_id,
        quantity: input.quantity,
        price: input.price,
        fees,
        amount,
        note: input.note.filter(|value| !value.trim().is_empty()),
    })
}

#[tauri::command]
fn create_opening_position_adjustments() -> Result<usize, String> {
    let mut connection = open_database()?;
    let sqlite_transaction = connection
        .transaction()
        .map_err(|error| format!("Impossible de démarrer la transaction SQLite : {error}"))?;

    let rows = {
        let mut statement = sqlite_transaction
            .prepare(
                "
                SELECT
                  p.account_id,
                  p.security_id,
                  p.quantity AS current_quantity,
                  p.average_price,
                  COALESCE(j.journal_quantity, 0) AS journal_quantity,
                  a.name AS account_name,
                  s.name AS security_name
                FROM positions p
                JOIN accounts a ON a.id = p.account_id
                JOIN securities s ON s.id = p.security_id
                LEFT JOIN (
                  SELECT
                    account_id,
                    security_id,
                    SUM(
                      CASE
                        WHEN type = 'buy' THEN COALESCE(quantity, 0)
                        WHEN type = 'sell' THEN -COALESCE(quantity, 0)
                        WHEN type = 'opening_position' THEN COALESCE(quantity, 0)
                        ELSE 0
                      END
                    ) AS journal_quantity
                  FROM transactions
                  WHERE account_id IS NOT NULL
                    AND security_id IS NOT NULL
                    AND type IN ('buy', 'sell', 'opening_position')
                  GROUP BY account_id, security_id
                ) j ON j.account_id = p.account_id AND j.security_id = p.security_id
                WHERE p.quantity > 0
                ORDER BY a.name, s.name
                ",
            )
            .map_err(|error| format!("Erreur SQL ajustements d'ouverture : {error}"))?;

        let mapped_rows = statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, f64>(2)?,
                    row.get::<_, f64>(3)?,
                    row.get::<_, f64>(4)?,
                    row.get::<_, String>(5)?,
                    row.get::<_, String>(6)?,
                ))
            })
            .map_err(|error| format!("Erreur lecture ajustements d'ouverture : {error}"))?;

        let mut rows = Vec::new();

        for row in mapped_rows {
            rows.push(
                row.map_err(|error| format!("Erreur conversion ajustement d'ouverture : {error}"))?,
            );
        }

        rows
    };

    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|error| format!("Erreur horloge système : {error}"))?
        .as_millis();

    let mut created_count = 0usize;

    for (
        index,
        (
            account_id,
            security_id,
            current_quantity,
            average_price,
            journal_quantity,
            account_name,
            security_name,
        ),
    ) in rows.into_iter().enumerate()
    {
        let difference = current_quantity - journal_quantity;

        if difference.abs() <= 0.000001 {
            continue;
        }

        let transaction_id = format!("tx-opening-{now_ms}-{index}");
        let note = format!(
            "Ajustement d'ouverture généré depuis le diagnostic : {security_name} / {account_name}."
        );

        sqlite_transaction
            .execute(
                "
                INSERT INTO transactions (
                  id,
                  date,
                  type,
                  account_id,
                  security_id,
                  quantity,
                  price,
                  fees,
                  amount,
                  note
                )
                VALUES (?1, date('now'), 'opening_position', ?2, ?3, ?4, ?5, 0, 0, ?6)
                ",
                params![
                    transaction_id,
                    account_id,
                    security_id,
                    difference,
                    average_price,
                    note
                ],
            )
            .map_err(|error| format!("Erreur création ajustement d'ouverture : {error}"))?;

        created_count += 1;
    }

    sqlite_transaction
        .commit()
        .map_err(|error| format!("Erreur validation ajustements d'ouverture : {error}"))?;

    Ok(created_count)
}

#[tauri::command]
fn create_opening_cash_adjustments() -> Result<usize, String> {
    let mut connection = open_database()?;
    let accounts = read_accounts(&connection)?;
    let sqlite_transaction = connection
        .transaction()
        .map_err(|error| format!("Impossible de démarrer la transaction SQLite : {error}"))?;

    let mut cash_by_account = HashMap::<String, f64>::new();

    {
        let mut statement = sqlite_transaction
            .prepare(
                "
                SELECT
                  type,
                  account_id,
                  from_account_id,
                  to_account_id,
                  amount,
                  quantity,
                  price,
                  fees
                FROM transactions
                ORDER BY date, created_at
                ",
            )
            .map_err(|error| format!("Erreur SQL reconstruction cash : {error}"))?;

        let rows = statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, f64>(4)?,
                    row.get::<_, Option<f64>>(5)?,
                    row.get::<_, Option<f64>>(6)?,
                    row.get::<_, f64>(7)?,
                ))
            })
            .map_err(|error| format!("Erreur lecture cash journal : {error}"))?;

        for row in rows {
            let (
                transaction_type,
                account_id,
                from_account_id,
                to_account_id,
                amount,
                quantity,
                price,
                fees,
            ) = row.map_err(|error| format!("Erreur conversion cash journal : {error}"))?;

            match transaction_type.as_str() {
                "deposit" => {
                    if let Some(to_account_id) = to_account_id {
                        *cash_by_account.entry(to_account_id).or_insert(0.0) += amount;
                    }
                }
                "withdrawal" => {
                    if let Some(from_account_id) = from_account_id {
                        *cash_by_account.entry(from_account_id).or_insert(0.0) -= amount;
                    }
                }
                "transfer" => {
                    if let Some(from_account_id) = from_account_id {
                        *cash_by_account.entry(from_account_id).or_insert(0.0) -= amount;
                    }

                    if let Some(to_account_id) = to_account_id {
                        *cash_by_account.entry(to_account_id).or_insert(0.0) += amount;
                    }
                }
                "buy" => {
                    if let (Some(account_id), Some(quantity), Some(price)) =
                        (account_id, quantity, price)
                    {
                        *cash_by_account.entry(account_id).or_insert(0.0) -=
                            quantity * price + fees;
                    }
                }
                "sell" => {
                    if let (Some(account_id), Some(quantity), Some(price)) =
                        (account_id, quantity, price)
                    {
                        *cash_by_account.entry(account_id).or_insert(0.0) +=
                            quantity * price - fees;
                    }
                }
                "opening_cash" => {
                    if let Some(account_id) = account_id {
                        *cash_by_account.entry(account_id).or_insert(0.0) += amount;
                    }
                }
                _ => {}
            }
        }
    }

    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("Erreur horloge système : {error}"))?
        .as_millis();

    let mut created_count = 0usize;

    for (index, account) in accounts.iter().enumerate() {
        let reconstructed_cash = cash_by_account.get(&account.id).copied().unwrap_or(0.0);
        let adjustment = account.cash_balance - reconstructed_cash;

        if adjustment.abs() <= 0.01 {
            continue;
        }

        let transaction_id = format!("tx-opening-cash-{now_ms}-{index}");
        let note = format!(
            "Ajustement cash d'ouverture généré depuis le diagnostic : {}.",
            account.name
        );

        sqlite_transaction
            .execute(
                "
                INSERT INTO transactions (
                  id,
                  date,
                  type,
                  account_id,
                  fees,
                  amount,
                  note
                )
                VALUES (?1, date('now'), 'opening_cash', ?2, 0, ?3, ?4)
                ",
                params![transaction_id, account.id, adjustment, note],
            )
            .map_err(|error| format!("Erreur création ajustement cash : {error}"))?;

        created_count += 1;
    }

    sqlite_transaction
        .commit()
        .map_err(|error| format!("Erreur validation ajustements cash : {error}"))?;

    Ok(created_count)
}

#[tauri::command]
fn update_transaction(input: UpdateTransactionInput) -> Result<String, String> {
    let new_transaction = stored_transaction_from_update_input(input)?;
    let mut connection = open_database()?;
    let sqlite_transaction = connection
        .transaction()
        .map_err(|error| format!("Impossible de démarrer la transaction SQLite : {error}"))?;

    let old_transaction = read_stored_transaction(&sqlite_transaction, &new_transaction.id)?;

    apply_stored_transaction_effect(&sqlite_transaction, &old_transaction, -1.0)?;
    apply_stored_transaction_effect(&sqlite_transaction, &new_transaction, 1.0)?;

    sqlite_transaction
        .execute(
            "
            UPDATE transactions
            SET date = ?1,
                type = ?2,
                from_account_id = ?3,
                to_account_id = ?4,
                account_id = ?5,
                security_id = ?6,
                quantity = ?7,
                price = ?8,
                fees = ?9,
                amount = ?10,
                note = ?11,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?12
            ",
            params![
                new_transaction.date,
                new_transaction.transaction_type,
                new_transaction.from_account_id,
                new_transaction.to_account_id,
                new_transaction.account_id,
                new_transaction.security_id,
                new_transaction.quantity,
                new_transaction.price,
                new_transaction.fees,
                new_transaction.amount,
                new_transaction.note,
                new_transaction.id
            ],
        )
        .map_err(|error| format!("Erreur mise à jour transaction : {error}"))?;

    sqlite_transaction
        .commit()
        .map_err(|error| format!("Erreur validation SQLite : {error}"))?;

    Ok("Transaction modifiée.".to_string())
}

#[tauri::command]
fn delete_transaction(transaction_id: String) -> Result<String, String> {
    if transaction_id.trim().is_empty() {
        return Err("Identifiant de transaction obligatoire.".to_string());
    }

    let mut connection = open_database()?;
    let sqlite_transaction = connection
        .transaction()
        .map_err(|error| format!("Impossible de démarrer la transaction SQLite : {error}"))?;

    let old_transaction = read_stored_transaction(&sqlite_transaction, transaction_id.trim())?;
    apply_stored_transaction_effect(&sqlite_transaction, &old_transaction, -1.0)?;

    sqlite_transaction
        .execute(
            "DELETE FROM transactions WHERE id = ?1",
            params![transaction_id.trim()],
        )
        .map_err(|error| format!("Erreur suppression transaction : {error}"))?;

    sqlite_transaction
        .commit()
        .map_err(|error| format!("Erreur validation SQLite : {error}"))?;

    Ok("Transaction supprimée.".to_string())
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
            update_account_cash(
                &sqlite_transaction,
                &input.account_id,
                -(gross_amount + input.fees),
            )?;

            let existing_position = sqlite_transaction
                .query_row(
                    "
                    SELECT id, quantity, average_price, current_price
                    FROM positions
                    WHERE account_id = ?1 AND security_id = ?2
                    ",
                    params![input.account_id, input.security_id],
                    |row| {
                        Ok((
                            row.get::<_, String>(0)?,
                            row.get::<_, f64>(1)?,
                            row.get::<_, f64>(2)?,
                            row.get::<_, f64>(3)?,
                        ))
                    },
                )
                .optional()
                .map_err(|error| format!("Erreur recherche position : {error}"))?;

            if let Some((position_id, old_quantity, old_average_price, old_current_price)) =
                existing_position
            {
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
                        params![
                            new_quantity,
                            new_average_price,
                            old_current_price,
                            position_id
                        ],
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
                        params![
                            position_id,
                            input.account_id,
                            input.security_id,
                            input.quantity,
                            average_price,
                            input.price
                        ],
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
                    |row| {
                        Ok((
                            row.get::<_, String>(0)?,
                            row.get::<_, f64>(1)?,
                            row.get::<_, f64>(2)?,
                            row.get::<_, f64>(3)?,
                        ))
                    },
                )
                .optional()
                .map_err(|error| format!("Erreur recherche position : {error}"))?;

            let Some((position_id, old_quantity, old_average_price, old_current_price)) =
                existing_position
            else {
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
                        params![
                            new_quantity,
                            old_average_price,
                            old_current_price,
                            position_id
                        ],
                    )
                    .map_err(|error| format!("Erreur réduction position : {error}"))?;
            }

            update_account_cash(
                &sqlite_transaction,
                &input.account_id,
                gross_amount - input.fees,
            )?;
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

    if !matches!(
        transaction_type,
        "deposit" | "withdrawal" | "transfer" | "dividend" | "fee"
    ) {
        return Err(
            "Cette commande accepte dépôt, retrait, transfert, dividende et frais.".to_string(),
        );
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
            let to_account_id = input.to_account_id.clone().ok_or_else(|| {
                "Compte de destination obligatoire pour un transfert.".to_string()
            })?;

            if from_account_id == to_account_id {
                return Err(
                    "Le compte source et le compte de destination doivent être différents."
                        .to_string(),
                );
            }

            update_account_cash(&sqlite_transaction, &from_account_id, -input.amount)?;
            update_account_cash(&sqlite_transaction, &to_account_id, input.amount)?;

            (Some(from_account_id), Some(to_account_id), None)
        }
        "dividend" => {
            let account_id = input
                .to_account_id
                .clone()
                .or_else(|| input.from_account_id.clone())
                .ok_or_else(|| "Compte obligatoire pour un dividende.".to_string())?;

            update_account_cash(&sqlite_transaction, &account_id, input.amount)?;

            (None, Some(account_id.clone()), Some(account_id))
        }
        "fee" => {
            let account_id = input
                .from_account_id
                .clone()
                .or_else(|| input.to_account_id.clone())
                .ok_or_else(|| "Compte obligatoire pour les frais.".to_string())?;

            update_account_cash(&sqlite_transaction, &account_id, -input.amount)?;

            (Some(account_id.clone()), None, Some(account_id))
        }
        _ => unreachable!(),
    };

    let security_id = match transaction_type {
        "dividend" | "fee" => input.security_id.filter(|value| !value.trim().is_empty()),
        _ => None,
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
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, NULL, NULL, 0, ?8, ?9)
            ",
            params![
                id,
                input.date,
                transaction_type,
                from_account_id,
                to_account_id,
                account_id,
                security_id,
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

fn atlas_download_directory() -> Result<PathBuf, String> {
    #[cfg(target_os = "linux")]
    {
        if let Ok(output) = Command::new("xdg-user-dir").arg("DOWNLOAD").output() {
            if output.status.success() {
                let directory = String::from_utf8_lossy(&output.stdout).trim().to_string();

                if !directory.is_empty() {
                    let path = PathBuf::from(directory);

                    fs::create_dir_all(&path).map_err(|error| {
                        format!("Impossible de créer le dossier de téléchargement : {error}")
                    })?;

                    return Ok(path);
                }
            }
        }
    }

    let home = env::var("HOME")
        .or_else(|_| env::var("USERPROFILE"))
        .map(PathBuf::from)
        .map_err(|_| "Impossible de trouver le dossier personnel.".to_string())?;

    let candidates = [home.join("Downloads"), home.join("Téléchargements")];

    for candidate in candidates {
        if candidate.exists() {
            return Ok(candidate);
        }
    }

    let fallback = home.join("Downloads");

    fs::create_dir_all(&fallback)
        .map_err(|error| format!("Impossible de créer le dossier Downloads : {error}"))?;

    Ok(fallback)
}

fn sanitize_csv_filename(filename: &str) -> String {
    let raw_name = PathBuf::from(filename.trim())
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("atlas-export.csv")
        .to_string();

    let mut sanitized = raw_name
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.') {
                character
            } else {
                '_'
            }
        })
        .collect::<String>();

    if sanitized.is_empty() {
        sanitized = "atlas-export.csv".to_string();
    }

    if !sanitized.to_ascii_lowercase().ends_with(".csv") {
        sanitized.push_str(".csv");
    }

    sanitized
}

fn unique_csv_export_path(directory: &PathBuf, filename: &str) -> PathBuf {
    let first_path = directory.join(filename);

    if !first_path.exists() {
        return first_path;
    }

    let stem = filename
        .strip_suffix(".csv")
        .or_else(|| filename.strip_suffix(".CSV"))
        .unwrap_or(filename);

    for index in 2..=9999 {
        let candidate = directory.join(format!("{stem}-{index}.csv"));

        if !candidate.exists() {
            return candidate;
        }
    }

    directory.join(format!(
        "{stem}-{}.csv",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_millis())
            .unwrap_or(0)
    ))
}

#[tauri::command]
fn save_csv_file(filename: String, content: String) -> Result<String, String> {
    let directory = atlas_download_directory()?;
    let safe_filename = sanitize_csv_filename(&filename);
    let path = unique_csv_export_path(&directory, &safe_filename);

    let csv_content = if content.starts_with('\u{feff}') {
        content
    } else {
        format!("\u{feff}{content}")
    };

    fs::write(&path, csv_content.as_bytes())
        .map_err(|error| format!("Impossible d’enregistrer le CSV : {error}"))?;

    Ok(path.display().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_accounts,
            create_account,
            update_account,
            get_portfolio_overview,
            get_dashboard_data,
            get_transactions,
            get_securities,
            get_positions_page,
            update_open_position_prices,
            create_security,
            search_online_assets,
            lookup_online_asset_history,
            lookup_online_asset_quote,
            create_security_from_online_result,
            create_cash_transaction,
            create_trade_transaction,
            update_transaction,
            delete_transaction,
            create_opening_position_adjustments,
            create_opening_cash_adjustments,
            save_csv_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
