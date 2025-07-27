import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";
import logger from "./logger";
import { log } from "console";

export class SQLiteDB {
	private db: Database | null = null;

	// 数据库文件路径
	private dbPath: string;

	// 建表语句
	private createTableSql: string;

	constructor(dbPath: string, createTableSql: string) {
		this.dbPath = dbPath;
		this.createTableSql = createTableSql;
	}

	// 打开数据库连接
	async open(): Promise<void> {
		try {
			if (!this.db) {
				this.db = await open({
					filename: this.dbPath,
					driver: sqlite3.Database
				});
				await this.db.exec(this.createTableSql);
			}
		} catch (error) {
			logger.error("创建数据库连接失败:", error);
			throw error;
		}
	}

	// 执行查询操作
	async query(sql: string, params?: any[]): Promise<any[]> {
		if (!this.db) {
			throw new Error("数据库未打开");
		}

		try {
			const result = await this.db.all(sql, params);
			return result;
		} catch (error) {
			logger.error("查询失败:", error);
			throw error;
		}
	}

	// 执行写操作 (INSERT, UPDATE, DELETE)
	async execute(sql: string, params?: any[]) {
		if (!this.db) {
			throw new Error("数据库未打开");
		}
		try {
			const result = await this.db.run(sql, params);
			return result;
		} catch (error) {
			logger.error("执行写操作错误: ", error);
			throw error;
		}
	}

	// 开启事务
	async beginTransaction(): Promise<void> {
		if (!this.db) {
			throw new Error("数据库未打开");
		}
		try {
			await this.db.exec("BEGIN TRANSACTION");
		} catch (error) {
			logger.error("开启事务失败: ", error);
			throw error;
		}
	}

	// 提交事务
	async commit(): Promise<void> {
		if (!this.db) {
			throw new Error("数据库未打开");
		}
		try {
			await this.db.exec("COMMIT");
		} catch (error) {
			logger.error("提交事务失败: ", error);
			throw error;
		}
	}

	// 回滚事务
	async rollback(): Promise<void> {
		if (!this.db) {
			throw new Error("数据库未打开");
		}
		try {
			await this.db.exec("ROLLBACK");
		} catch (error) {
			logger.error("回滚事务失败: ", error);
			throw error;
		}
	}

	// 关闭数据库连接
	async close(): Promise<void> {
		if (this.db) {
			try {
				await this.db.close();
				this.db = null;
			} catch (error) {
				logger.error("关闭数据库连接失败: ", error);
				throw error;
			}
		}
	}
}
