BEGIN TRANSACTION;

INSERT INTO "revisions" ("revisionId","sha") VALUES (1,'0000000000000000000000000000000000000000');
INSERT INTO "revisions" ("revisionId","sha") VALUES (2,'1111111111111111111111111111111111111111');
INSERT INTO "revisions" ("revisionId","sha") VALUES (3,'2222222222222222222222222222222222222222');

INSERT INTO "machines" ("machineId","info") VALUES (1,'Azure');

INSERT INTO "overviews" ("overviewId","overviewJson") VALUES (1,'empty');

INSERT INTO "files" ("fileId","name") VALUES (1,'example1');
INSERT INTO "files" ("fileId","name") VALUES (2,'example2');
INSERT INTO "files" ("fileId","name") VALUES (3,'example3');
INSERT INTO "files" ("fileId","name") VALUES (4,'source1');
INSERT INTO "files" ("fileId","name") VALUES (5,'source2');
INSERT INTO "files" ("fileId","name") VALUES (6,'source3');
INSERT INTO "files" ("fileId","name") VALUES (7,'source4');
INSERT INTO "files" ("fileId","name") VALUES (8,'source5');

INSERT INTO "runs" ("runId","revisionId","timestamp","duration","delayAfterCommit","reason","baselineRunId","parentRunId","dependenciesChanged","machineId","majorErrors","overviewId","type") VALUES (1,1,0,0,0,'CI',NULL,NULL,'true',1,0,1,NULL);
INSERT INTO "runs" ("runId","revisionId","timestamp","duration","delayAfterCommit","reason","baselineRunId","parentRunId","dependenciesChanged","machineId","majorErrors","overviewId","type") VALUES (2,2,0,0,0,'CI',1,1,'false',1,0,1,NULL);
INSERT INTO "runs" ("runId","revisionId","timestamp","duration","delayAfterCommit","reason","baselineRunId","parentRunId","dependenciesChanged","machineId","majorErrors","overviewId","type") VALUES (3,3,0,0,0,'CI',1,2,'false',1,0,1,NULL);

INSERT INTO "main"."tests" ("testId", "group", "name", "description", "text", "available", "flaky") VALUES ('1', 'checks', 'DocsDecl', 'Docs vs. Declaration', 'Parse the documentation and compare it against the declaration files', '1', '0');
INSERT INTO "main"."tests" ("testId", "group", "name", "description", "text", "available", "flaky") VALUES ('2', 'checks', 'Foo', 'Bar', 'Baz', '1', '0');

INSERT INTO "main"."results" ("resultId", "testId", "fileId", "value") VALUES ('1', '1', '1', '10');
INSERT INTO "main"."results" ("resultId", "testId", "fileId", "value") VALUES ('2', '1', '1', '15');
INSERT INTO "main"."results" ("resultId", "testId", "fileId", "value") VALUES ('3', '1', '2', '20');
INSERT INTO "main"."results" ("resultId", "testId", "fileId", "value") VALUES ('4', '1', '2', NULL);
INSERT INTO "main"."results" ("resultId", "testId", "fileId", "value") VALUES ('5', '1', '3', '23');
INSERT INTO "main"."results" ("resultId", "testId", "fileId", "value") VALUES ('6', '1', '4', '44');
INSERT INTO "main"."results" ("resultId", "testId", "fileId", "value") VALUES ('7', '2', '5', '55');

INSERT INTO "main"."runs2results" ("r2rId", "runId", "resultId") VALUES ('1', '1', '1');
INSERT INTO "main"."runs2results" ("r2rId", "runId", "resultId") VALUES ('2', '1', '3');
INSERT INTO "main"."runs2results" ("r2rId", "runId", "resultId") VALUES ('3', '1', '5');
INSERT INTO "main"."runs2results" ("r2rId", "runId", "resultId") VALUES ('4', '1', '6');
INSERT INTO "main"."runs2results" ("r2rId", "runId", "resultId") VALUES ('5', '2', '2');
INSERT INTO "main"."runs2results" ("r2rId", "runId", "resultId") VALUES ('6', '2', '4');
INSERT INTO "main"."runs2results" ("r2rId", "runId", "resultId") VALUES ('7', '2', '5');
INSERT INTO "main"."runs2results" ("r2rId", "runId", "resultId") VALUES ('8', '2', '7');

COMMIT;