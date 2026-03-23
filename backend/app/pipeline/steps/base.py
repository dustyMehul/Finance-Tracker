from abc import ABC, abstractmethod
from app.pipeline.context import PipelineContext
from app.core.logging import get_logger


class PipelineStep(ABC):
    """
    Base class for all pipeline steps.

    Each step receives the full PipelineContext, reads what it needs,
    and writes its output back onto the context. Steps never return values.

    Subclass and implement run(). Call super().__init__() to get self.logger.

    Example:
        class MyStep(PipelineStep):
            def run(self, ctx: PipelineContext) -> None:
                self.logger.info("Running MyStep on job %s", ctx.job_id)
                # read from ctx, write back to ctx
    """

    def __init__(self):
        self.logger = get_logger(self.__class__.__name__)

    @abstractmethod
    def run(self, ctx: PipelineContext) -> None:
        """
        Execute this step. Mutates ctx in place.
        On unrecoverable errors, call ctx.add_error() and return early.
        On minor issues, call ctx.add_warning() and continue.
        Never raise exceptions — the runner should not need try/except per step.
        """
        ...

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__}>"
