use rusqlite::Connection;
use serde::Serialize;
use std::path::PathBuf;

#[derive(Debug, Serialize)]
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

#[tauri::command]
fn get_accounts() -> Result<Vec<DbAccount>, String> {
    let connection = open_database()?;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_accounts, get_portfolio_overview])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
