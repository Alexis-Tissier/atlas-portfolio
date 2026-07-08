use rusqlite::Connection;
use serde::Serialize;
use std::collections::HashMap;
use std::path::PathBuf;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_accounts, get_portfolio_overview, get_dashboard_data])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
