import * as migration_20260403_124224 from './20260403_124224';
import * as migration_20260407_093209_add_product_import_meta from './20260407_093209_add_product_import_meta';
import * as migration_20260408_120000_add_import_sessions from './20260408_120000_add_import_sessions';

export const migrations = [
  {
    up: migration_20260403_124224.up,
    down: migration_20260403_124224.down,
    name: '20260403_124224',
  },
  {
    up: migration_20260407_093209_add_product_import_meta.up,
    down: migration_20260407_093209_add_product_import_meta.down,
    name: '20260407_093209_add_product_import_meta'
  },
  {
    up: migration_20260408_120000_add_import_sessions.up,
    down: migration_20260408_120000_add_import_sessions.down,
    name: '20260408_120000_add_import_sessions'
  },
];
