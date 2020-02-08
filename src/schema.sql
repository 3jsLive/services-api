PRAGMA foreign_keys = '0';

BEGIN TRANSACTION;

DROP TABLE IF EXISTS "revisions";
CREATE TABLE IF NOT EXISTS "revisions" (
	"revisionId"	INTEGER NOT NULL UNIQUE,
	"sha"	TEXT NOT NULL UNIQUE,
	PRIMARY KEY("revisionId")
);
DROP TABLE IF EXISTS "machines";
CREATE TABLE IF NOT EXISTS "machines" (
	"machineId"	INTEGER NOT NULL UNIQUE,
	"info"	TEXT NOT NULL UNIQUE,
	PRIMARY KEY("machineId")
);
DROP TABLE IF EXISTS "overviews";
CREATE TABLE IF NOT EXISTS "overviews" (
	"overviewId"	INTEGER NOT NULL UNIQUE,
	"overviewJson"	TEXT NOT NULL UNIQUE,
	PRIMARY KEY("overviewId")
);
DROP TABLE IF EXISTS "files";
CREATE TABLE IF NOT EXISTS "files" (
	"fileId"	INTEGER NOT NULL UNIQUE,
	"name"	TEXT NOT NULL UNIQUE,
	PRIMARY KEY("fileId")
);
DROP TABLE IF EXISTS "updates";
CREATE TABLE IF NOT EXISTS "updates" (
	"updateId"	INTEGER NOT NULL UNIQUE,
	"testId"	INTEGER NOT NULL,
	"timestamp"	INTEGER NOT NULL,
	"reason"	TEXT NOT NULL,
	FOREIGN KEY("testId") REFERENCES "tests"("testId"),
	PRIMARY KEY("updateId")
);
DROP TABLE IF EXISTS "results";
CREATE TABLE IF NOT EXISTS "results" (
	"resultId"	INTEGER NOT NULL UNIQUE,
	"testId"	INTEGER NOT NULL,
	"fileId"	INTEGER NOT NULL,
	"value"	INTEGER NOT NULL,
	PRIMARY KEY("resultId"),
	UNIQUE("testId","fileId","value"),
	FOREIGN KEY("testId") REFERENCES "tests"("testId")
);
DROP TABLE IF EXISTS "runs2results";
CREATE TABLE IF NOT EXISTS "runs2results" (
	"r2rId"	INTEGER NOT NULL UNIQUE,
	"runId"	INTEGER NOT NULL,
	"resultId"	INTEGER NOT NULL,
	PRIMARY KEY("r2rId"),
	FOREIGN KEY("resultId") REFERENCES "results"("resultId"),
	UNIQUE("runId","resultId"),
	FOREIGN KEY("runId") REFERENCES "runs"("runId")
);
DROP TABLE IF EXISTS "errors";
CREATE TABLE IF NOT EXISTS "errors" (
	"errorId"	INTEGER NOT NULL UNIQUE,
	"runId"	INTEGER NOT NULL,
	"testId"	INTEGER NOT NULL,
	"value"	INTEGER NOT NULL,
	PRIMARY KEY("errorId"),
	UNIQUE("runId","testId"),
	FOREIGN KEY("runId") REFERENCES "runs"("runId"),
	FOREIGN KEY("testId") REFERENCES "tests"("testId")
);
DROP TABLE IF EXISTS "runs";
CREATE TABLE IF NOT EXISTS "runs" (
	"runId"	INTEGER NOT NULL UNIQUE,
	"revisionId"	INTEGER NOT NULL UNIQUE,
	"timestamp"	INTEGER NOT NULL,
	"duration"	INTEGER NOT NULL,
	"delayAfterCommit"	INTEGER NOT NULL,
	"reason"	TEXT NOT NULL,
	"baselineRunId"	INTEGER,
	"parentRunId"	INTEGER,
	"dependenciesChanged"	TEXT NOT NULL,
	"machineId"	INTEGER NOT NULL,
	"majorErrors"	INTEGER DEFAULT 0,
	"overviewId"	INTEGER,
	"type"	TEXT,
	FOREIGN KEY("revisionId") REFERENCES "revisions"("revisionId"),
	FOREIGN KEY("parentRunId") REFERENCES "runs"("runId"),
	FOREIGN KEY("machineId") REFERENCES "machines"("machineId"),
	FOREIGN KEY("baselineRunId") REFERENCES "runs"("runId"),
	PRIMARY KEY("runId")
);
DROP TABLE IF EXISTS "dependencies";
CREATE TABLE IF NOT EXISTS "dependencies" (
	"dependencyId"	INTEGER NOT NULL UNIQUE,
	"revisionId"	INTEGER NOT NULL,
	"srcFileId"	INTEGER NOT NULL,
	"depFileId"	INTEGER NOT NULL,
	"value"	INTEGER,
	UNIQUE("revisionId","srcFileId","depFileId"),
	PRIMARY KEY("dependencyId")
);
DROP TABLE IF EXISTS "tests";
CREATE TABLE IF NOT EXISTS "tests" (
	"testId"	INTEGER NOT NULL UNIQUE,
	"group"	TEXT NOT NULL,
	"name"	TEXT NOT NULL UNIQUE,
	"description"	TEXT,
	"text"	TEXT,
	"available"	INTEGER NOT NULL DEFAULT 0,
	"flaky"	INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY("testId"),
	UNIQUE("group","name")
);
DROP INDEX IF EXISTS "IX_results_testId";
CREATE INDEX IF NOT EXISTS "IX_results_testId" ON "results" (
	"testId"	ASC
);
DROP INDEX IF EXISTS "IX_results_fileId";
CREATE INDEX IF NOT EXISTS "IX_results_fileId" ON "results" (
	"fileId"	ASC
);
DROP INDEX IF EXISTS "IX_runs2results_runId";
CREATE INDEX IF NOT EXISTS "IX_runs2results_runId" ON "runs2results" (
	"runId"	ASC
);
DROP INDEX IF EXISTS "IX_runs2results_resultId";
CREATE INDEX IF NOT EXISTS "IX_runs2results_resultId" ON "runs2results" (
	"resultId"	ASC
);
DROP INDEX IF EXISTS "IX_errors_runId";
CREATE INDEX IF NOT EXISTS "IX_errors_runId" ON "errors" (
	"runId"	ASC
);
DROP INDEX IF EXISTS "IX_errors_testId";
CREATE INDEX IF NOT EXISTS "IX_errors_testId" ON "errors" (
	"testId"	ASC
);
DROP INDEX IF EXISTS "IX_runs_baselineRunId";
CREATE INDEX IF NOT EXISTS "IX_runs_baselineRunId" ON "runs" (
	"baselineRunId"	ASC
);
DROP INDEX IF EXISTS "IX_runs_parentRunId";
CREATE INDEX IF NOT EXISTS "IX_runs_parentRunId" ON "runs" (
	"parentRunId"	ASC
);
DROP INDEX IF EXISTS "IX_tests_name";
CREATE INDEX IF NOT EXISTS "IX_tests_name" ON "tests" (
	"name"	ASC
);
DROP INDEX IF EXISTS "IX_runs_revisionId";
CREATE UNIQUE INDEX IF NOT EXISTS "IX_runs_revisionId" ON "runs" (
	"revisionId"	ASC
);
DROP INDEX IF EXISTS "IX_dependencies_srcFileId";
CREATE INDEX IF NOT EXISTS "IX_dependencies_srcFileId" ON "dependencies" (
	"srcFileId"	ASC
);
DROP INDEX IF EXISTS "IX_dependencies_depFileId";
CREATE INDEX IF NOT EXISTS "IX_dependencies_depFileId" ON "dependencies" (
	"depFileId"	ASC
);
DROP INDEX IF EXISTS "IX_dependencies_value";
CREATE INDEX IF NOT EXISTS "IX_dependencies_value" ON "dependencies" (
	"value"	ASC
);
DROP INDEX IF EXISTS "IX_dependencies_revisionId";
CREATE INDEX IF NOT EXISTS "IX_dependencies_revisionId" ON "dependencies" (
	"revisionId"	ASC
);
DROP INDEX IF EXISTS "src-value";
CREATE INDEX IF NOT EXISTS "src-value" ON "dependencies" (
	"srcFileId"	ASC,
	"value"
);

COMMIT;

PRAGMA foreign_keys = '1';
