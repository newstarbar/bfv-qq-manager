export interface Command {
    regexContent: string;
    description: string;
    adminLevel: number;
    isMatch(command: string): boolean;
    getInfo(): string;
    execute(command: string, group_id: number, message_id: number, user_id: number): any;
}

export interface PrivateCommand {
    regexContent: string;
    description: string;
    adminLevel: number;
    isMatch(command: string): boolean;
    getInfo(): string;
    execute(command: string, message_id: number, user_id: number): any;
}

