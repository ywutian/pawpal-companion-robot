"""One transactional local snapshot; no accounts or cloud service required."""
import json
from pathlib import Path
import sqlite3


class StateStore:
    def __init__(self, path):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(path, check_same_thread=False)
        self.db.execute("PRAGMA journal_mode=WAL")
        self.db.execute("CREATE TABLE IF NOT EXISTS snapshot (id INTEGER PRIMARY KEY, payload TEXT NOT NULL)")

    def load(self):
        row = self.db.execute("SELECT payload FROM snapshot WHERE id=1").fetchone()
        return json.loads(row[0]) if row else None

    def save(self, value):
        with self.db:
            self.db.execute("INSERT OR REPLACE INTO snapshot VALUES (1, ?)",
                            (json.dumps(value, ensure_ascii=False, allow_nan=False),))

    def close(self):
        self.db.close()
