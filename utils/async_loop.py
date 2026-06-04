import asyncio
import threading

# Initialize event loop in background thread
_loop = asyncio.new_event_loop()

def _start_background_loop(loop):
    asyncio.set_event_loop(loop)
    loop.run_forever()

_thread = threading.Thread(target=_start_background_loop, args=(_loop,), daemon=True)
_thread.start()

def run_in_background(coro):
    """Executes a coroutine in the background loop and blocks for the result."""
    future = asyncio.run_coroutine_threadsafe(coro, _loop)
    return future.result()
