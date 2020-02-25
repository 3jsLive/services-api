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
INSERT INTO "dependencies" ("dependencyId","revisionId","srcFileId","depFileId","value") VALUES (1,1,1,4,1);
INSERT INTO "dependencies" ("dependencyId","revisionId","srcFileId","depFileId","value") VALUES (2,1,1,5,1);
INSERT INTO "dependencies" ("dependencyId","revisionId","srcFileId","depFileId","value") VALUES (3,1,1,6,1);
INSERT INTO "dependencies" ("dependencyId","revisionId","srcFileId","depFileId","value") VALUES (4,2,1,7,1);
INSERT INTO "dependencies" ("dependencyId","revisionId","srcFileId","depFileId","value") VALUES (5,2,2,4,1);
INSERT INTO "dependencies" ("dependencyId","revisionId","srcFileId","depFileId","value") VALUES (6,3,1,4,NULL);
INSERT INTO "dependencies" ("dependencyId","revisionId","srcFileId","depFileId","value") VALUES (7,3,2,8,1);
COMMIT;