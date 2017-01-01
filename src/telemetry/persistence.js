'use strict';

const path = require('path')

const L = require('modulog').bound('telemetry.persistence'),
      SQLite = require('sqlite3')

let db = new SQLite.Database(path.join(__dirname, '../../telemetry.db'))

db.exec(`
  CREATE TABLE IF NOT EXISTS telemetry_entries
  (
    received_time TEXT,
    received_ip TEXT,
    session_id TEXT,
    received_type TEXT,
    received_data TEXT
  );

  CREATE TABLE IF NOT EXISTS telemetry_errors
  (
    received_time TEXT,
    received_ip TEXT,
    session_id TEXT,
    received_type TEXT,
    received_data TEXT
  );
`)

const _writeToTable = (table, ip, incoming) => {
  return new Promise((res, rej) => {
    let now = new Date().toISOString()
    let failed = false
    db.run(
      `INSERT INTO ${table} VALUES (?, ?, ?, ?, ?)`,
      now, ip, incoming.s, incoming.type, JSON.stringify(incoming.data),
      (e) => {
        // When there's an error, the callback is called twice --
        // once within the error context, and once after the execution :/
        if (e) {
          failed = true
          rej(e)
        } else {
          if (!failed) res(true)
        }
      }
    )
  })
}

exports.writeRecord = (ip, incoming) => {
  return _writeToTable('telemetry_entries', ip, incoming)
}

exports.writeError = (ip, incoming) => {
  return _writeToTable('telemetry_errors', ip, incoming)
}
