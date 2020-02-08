BEGIN TRANSACTION;
INSERT INTO "files" ("fileId","name") VALUES (1,'example1');
INSERT INTO "files" ("fileId","name") VALUES (2,'example2');
INSERT INTO "files" ("fileId","name") VALUES (3,'example3');
COMMIT;
