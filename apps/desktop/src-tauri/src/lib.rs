use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

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

#[derive(Debug, Deserialize)]
struct NewCashTransaction {
    transaction_type: String,
    date: String,
    from_account_id: Option<String>,
    to_account_id: Option<String>,
    amount: f64,
    note: Option<String>,
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
            create_cash_transaction
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
