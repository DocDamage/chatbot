"""Project-owned adapter to an external Aider runtime; edits only a selected snapshot."""
import json
import os
import sys
from pathlib import Path

from aider.io import InputOutput
from aider.models import Model
from aider.coders.wholefile_coder import WholeFileCoder


def main():
    request = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    root = Path.cwd().resolve()
    allowed = {(root / name).resolve() for name in request["files"]}
    read_only = {(root / name).resolve() for name in request.get("readOnly", [])}
    if any(not file.is_relative_to(root) for file in allowed | read_only) or allowed & read_only:
        raise ValueError("Aider input escaped its snapshot")

    class ScopedIO(InputOutput):
        def confirm_ask(self, *args, **kwargs):
            return False

        def prompt_ask(self, *args, **kwargs):
            raise RuntimeError("Interactive prompts are disabled")

        def read_text(self, filename, *args, **kwargs):
            if Path(filename).resolve() not in allowed | read_only:
                raise ValueError("Aider may read only the selected snapshot files")
            return super().read_text(filename, *args, **kwargs)

        def write_text(self, filename, content, *args, **kwargs):
            if Path(filename).resolve() not in allowed:
                raise ValueError("Aider may write only the selected snapshot files")
            return super().write_text(filename, content, *args, **kwargs)

    class ScopedCoder(WholeFileCoder):
        def allowed_to_edit(self, filename):
            return Path(self.abs_root_path(filename)).resolve() in allowed

    io = ScopedIO(pretty=False, yes=False, chat_history_file=None, input_history_file=None)
    model = Model(request["model"], weak_model=False)
    model.extra_params = {**(model.extra_params or {}), "temperature": 0, "max_tokens": 4096,
                          "num_ctx": request["contextTokens"], "think": request.get("think", False), "timeout": 180}
    # Each worker handles one bounded task, so it never needs a second model
    # request just to summarize a conversation before exiting.
    model.max_chat_history_tokens = request["contextTokens"]
    model.weak_model = model
    model.info = {**(model.info or {}), "max_input_tokens": request["contextTokens"], "max_output_tokens": 4096}
    coder = ScopedCoder(main_model=model, io=io, fnames=[str(file) for file in allowed],
                        read_only_fnames=[str(file) for file in read_only],
                        use_git=False, auto_commits=False, dirty_commits=False,
                        auto_lint=False, auto_test=False, suggest_shell_commands=False,
                        stream=False, map_tokens=0)
    coder.detect_urls = False
    coder.max_reflections = 2
    coder.run(with_message=request["message"], preproc=False)
    print("\nCHATBOT_AIDER_FINISHED")


if __name__ == "__main__":
    main()
