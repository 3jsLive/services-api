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
	UNIQUE("testId","fileId","value"),
	FOREIGN KEY("testId") REFERENCES "tests"("testId"),
	PRIMARY KEY("resultId")
);
DROP TABLE IF EXISTS "runs2results";
CREATE TABLE IF NOT EXISTS "runs2results" (
	"r2rId"	INTEGER NOT NULL UNIQUE,
	"runId"	INTEGER NOT NULL,
	"resultId"	INTEGER NOT NULL,
	PRIMARY KEY("r2rId"),
	FOREIGN KEY("runId") REFERENCES "runs"("runId"),
	FOREIGN KEY("resultId") REFERENCES "results"("resultId"),
	UNIQUE("runId","resultId")
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
	FOREIGN KEY("parentRunId") REFERENCES "runs"("runId"),
	FOREIGN KEY("machineId") REFERENCES "machines"("machineId"),
	FOREIGN KEY("baselineRunId") REFERENCES "runs"("runId"),
	PRIMARY KEY("runId"),
	FOREIGN KEY("revisionId") REFERENCES "revisions"("revisionId")
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
	UNIQUE("group","name"),
	PRIMARY KEY("testId")
);
INSERT INTO "revisions" ("revisionId","sha") VALUES (1,'8e9cd31b6ec0303b30fd851d9dee5d178b3fca72');
INSERT INTO "revisions" ("revisionId","sha") VALUES (2,'8604213c9dd95ed42931b755bffce838f917ccb0');
INSERT INTO "machines" ("machineId","info") VALUES (1,'Azure');
INSERT INTO "overviews" ("overviewId","overviewJson") VALUES (1,'empty');
INSERT INTO "files" ("fileId","name") VALUES (1487,'examples/jsm/csm/CSM.js');
INSERT INTO "files" ("fileId","name") VALUES (1488,'examples/jsm/csm/Frustum.js');
INSERT INTO "files" ("fileId","name") VALUES (1489,'examples/jsm/csm/FrustumBoundingBox.js');
INSERT INTO "files" ("fileId","name") VALUES (1490,'examples/jsm/csm/FrustumVertex.js');
INSERT INTO "files" ("fileId","name") VALUES (1491,'examples/jsm/csm/Shader.js');
INSERT INTO "files" ("fileId","name") VALUES (1492,'examples/jsm/csm/Utils.js');
INSERT INTO "files" ("fileId","name") VALUES (2018,'examples/webgl_shadowmap_csm.html');
INSERT INTO "runs" ("runId","revisionId","timestamp","duration","delayAfterCommit","reason","baselineRunId","parentRunId","dependenciesChanged","machineId","majorErrors","overviewId","type") VALUES (1,1,0,0,0,'CI',NULL,NULL,'true',1,0,1,NULL);
INSERT INTO "runs" ("runId","revisionId","timestamp","duration","delayAfterCommit","reason","baselineRunId","parentRunId","dependenciesChanged","machineId","majorErrors","overviewId","type") VALUES (2,2,0,0,0,'CI',1,1,'false',1,0,1,NULL);
INSERT INTO "dependencies" ("dependencyId","revisionId","srcFileId","depFileId","value") VALUES (3785655,1,2018,1487,1);
INSERT INTO "dependencies" ("dependencyId","revisionId","srcFileId","depFileId","value") VALUES (3785656,1,2018,1488,1);
INSERT INTO "dependencies" ("dependencyId","revisionId","srcFileId","depFileId","value") VALUES (3785657,1,2018,1489,1);
INSERT INTO "dependencies" ("dependencyId","revisionId","srcFileId","depFileId","value") VALUES (3785658,1,2018,1490,1);
INSERT INTO "dependencies" ("dependencyId","revisionId","srcFileId","depFileId","value") VALUES (3785659,1,2018,1491,1);
INSERT INTO "dependencies" ("dependencyId","revisionId","srcFileId","depFileId","value") VALUES (3785867,2,2018,1487,1);
INSERT INTO "dependencies" ("dependencyId","revisionId","srcFileId","depFileId","value") VALUES (3785868,2,2018,1488,1);
INSERT INTO "dependencies" ("dependencyId","revisionId","srcFileId","depFileId","value") VALUES (3785869,2,2018,1489,1);
INSERT INTO "dependencies" ("dependencyId","revisionId","srcFileId","depFileId","value") VALUES (3785870,2,2018,1490,1);
INSERT INTO "dependencies" ("dependencyId","revisionId","srcFileId","depFileId","value") VALUES (3785871,2,2018,1491,1);
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
