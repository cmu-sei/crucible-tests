-- Copyright 2026 Carnegie Mellon University. All Rights Reserved.
-- Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

-- One database per app, the same names the AppHost creates (postgres.AddDatabase).
-- The APIs migrate their own schemas on startup. Keycloak uses its own dev-file store.
CREATE DATABASE player;
CREATE DATABASE player_vm;
CREATE DATABASE player_vm_logging;
CREATE DATABASE caster;
CREATE DATABASE alloy;
CREATE DATABASE topomojo;
CREATE DATABASE steamfitter;
CREATE DATABASE cite;
CREATE DATABASE gallery;
CREATE DATABASE blueprint;
CREATE DATABASE gameboard;
