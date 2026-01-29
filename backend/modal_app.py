"""
GradTrack AI - Modal Deployment

Deploy the FastAPI backend to Modal.com for serverless hosting.
"""

import modal
import os

# Create Modal app
app = modal.App("gradtrack-ai")

# Create a Modal image with all dependencies
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "fastapi==0.109.0",
        "uvicorn==0.27.0",
        "python-dotenv==1.0.0",
        "pydantic==2.5.3",
        "openai==1.12.0",
        "httpx==0.26.0",
        "python-multipart==0.0.6",
        "google-auth==2.27.0",
        "google-auth-oauthlib==1.2.0", 
        "google-auth-httplib2==0.2.0",
        "google-api-python-client==2.116.0",
    )
    .add_local_python_source("main")
    .add_local_python_source("database")
    .add_local_python_source("agent")
    .add_local_python_source("memory")
    .add_local_python_source("email_service")
    .add_local_python_source("web_search_service")
)


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("gradtrack-secrets")],
    allow_concurrent_inputs=100,
    container_idle_timeout=300,
)
@modal.asgi_app()
def fastapi_app():
    """Deploy the FastAPI app to Modal."""
    # Set environment variables from Modal secrets
    os.environ["OPENROUTER_API_KEY"] = os.environ.get("OPENROUTER_API_KEY", "")
    os.environ["SERPER_API_KEY"] = os.environ.get("SERPER_API_KEY", "")
    
    from main import app as gradtrack_app
    return gradtrack_app


# For local testing
if __name__ == "__main__":
    print("To deploy, run: modal deploy modal_app.py")
    print("To test locally, run: modal serve modal_app.py")
