from typing import Dict, Any, Callable, List
import os
import math

class SafeTool:
    def __init__(
        self,
        name: str,
        description: str,
        schema: Dict[str, Any],
        callable_func: Callable,
        category: str,
        is_mutating: bool = False,
        is_destructive: bool = False,
    ):
        self.name = name
        self.description = description
        self.schema = schema
        self.callable_func = callable_func
        self.category = category
        self.is_mutating = is_mutating
        self.is_destructive = is_destructive

class ToolRegistry:
    def __init__(self, workspace_dir: str):
        self.workspace_dir = os.path.abspath(workspace_dir)
        os.makedirs(self.workspace_dir, exist_ok=True)
        self.tools: Dict[str, SafeTool] = {}
        self._register_defaults()

    def _safe_path(self, path: str) -> str:
        """Ensure path is within the sandbox workspace."""
        full_path = os.path.abspath(os.path.join(self.workspace_dir, path))
        if not full_path.startswith(self.workspace_dir):
            raise PermissionError(f"Path traversal denied: {path}")
        return full_path

    def register(self, tool: SafeTool):
        self.tools[tool.name] = tool

    def get_tool(self, name: str) -> SafeTool:
        if name not in self.tools:
            raise ValueError(f"Unknown tool: {name}")
        return self.tools[name]

    def _read_file(self, file_path: str) -> str:
        safe_path = self._safe_path(file_path)
        with open(safe_path, 'r', encoding='utf-8') as f:
            return f.read()

    def _write_file(self, file_path: str, content: str) -> str:
        safe_path = self._safe_path(file_path)
        os.makedirs(os.path.dirname(safe_path), exist_ok=True)
        with open(safe_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return f"Wrote {len(content)} bytes to {file_path}"

    def _list_directory(self, dir_path: str = ".") -> List[str]:
        safe_path = self._safe_path(dir_path)
        return os.listdir(safe_path)

    def _calculate(self, expression: str) -> float:
        # Very safe calculate using eval with no builtins except math functions
        allowed_names = {k: v for k, v in math.__dict__.items() if not k.startswith("__")}
        code = compile(expression, "<string>", "eval")
        for name in code.co_names:
            if name not in allowed_names:
                raise NameError(f"Use of {name} not allowed")
        return eval(code, {"__builtins__": {}}, allowed_names)

    def _register_defaults(self):
        self.register(SafeTool(
            name="read_file",
            description="Reads the contents of a file.",
            schema={
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "Path to the file to read"}
                },
                "required": ["file_path"]
            },
            callable_func=self._read_file,
            category="file_system_read",
            is_mutating=False,
            is_destructive=False
        ))
        
        self.register(SafeTool(
            name="write_file",
            description="Writes content to a file.",
            schema={
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "Path to the file to write"},
                    "content": {"type": "string", "description": "Content to write"}
                },
                "required": ["file_path", "content"]
            },
            callable_func=self._write_file,
            category="file_system_write",
            is_mutating=True,
            is_destructive=True
        ))

        self.register(SafeTool(
            name="list_directory",
            description="Lists files in a directory.",
            schema={
                "type": "object",
                "properties": {
                    "dir_path": {"type": "string", "description": "Path to the directory"}
                },
                "required": ["dir_path"]
            },
            callable_func=self._list_directory,
            category="file_system_read",
            is_mutating=False,
            is_destructive=False
        ))

        self.register(SafeTool(
            name="calculate",
            description="Evaluates a mathematical expression safely.",
            schema={
                "type": "object",
                "properties": {
                    "expression": {"type": "string", "description": "Mathematical expression"}
                },
                "required": ["expression"]
            },
            callable_func=self._calculate,
            category="code_execution",
            is_mutating=False,
            is_destructive=False
        ))
