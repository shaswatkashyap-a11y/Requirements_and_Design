import os
import sys

from logging.config import fileConfig

from sqlalchemy import engine_from_config, create_engine
from sqlalchemy import pool

from alembic import context

#import the mysql DB url
from app.db.database import DATABASE_URL,Base

#importing all the models,
#importing all models (from app.models import *) ensures that your SQLAlchemy models are actively loaded into memory.
#If they aren't imported before Alembic runs, Alembic won't see them and will think your database is supposed to be empty!
from app.models import *


#This line of code is a common Python trick used to modify the module search path dynamically.
#  In short, it finds the grandparent directory of the current script and 
# adds it to the very top of the list of directories Python checks when you use an import statement.
sys.path.insert(0,os.path.dirname(os.path.dirname(__file__))) #path to rdstudio folder

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config


# DATABASE_URL is passed directly to avoid configparser % interpolation issues
# (passwords with %40 etc. break config.set_main_option)


# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
# from myapp import mymodel
# target_metadata = mymodel.Base.metadata
target_metadata = Base.metadata

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    context.configure(
        url=DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = create_engine(DATABASE_URL, poolclass=pool.NullPool)

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
