from fastapi import APIRouter, HTTPException, status
from app.models.schemas import ClassifyRequest, ClassifyResponse, BusinessSize
from app.services.ml_classifier import classifier
from app.services.ml_classifier import FEATURE_SCHEMA

router = APIRouter()


@router.post("/classify", response_model=ClassifyResponse)
async def classifyBusiness(request: ClassifyRequest):
    """
    Classify a business tier using the ML model.
    Accepts ordinal answers from the guided question form.
    NaN/null values for scale, volume, complexity are handled natively.
    """
    try:
        result = classifier.predict(request.dict())
        return ClassifyResponse(
            classification=BusinessSize(result["classification"]),
            confidence=result["confidence"],
            signalQuality=result["signalQuality"],
            probabilities=result["probabilities"],
            message=result["message"],
        )
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"message": "ML classifier not ready.", "error": str(e)},
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"message": "Classification failed.", "error": str(e)},
        )


@router.get("/status")
async def getModelStatus():
    """Return ML model health info: accuracy, sample count, last retrain time."""
    try:
        return classifier.get_status()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"message": "Could not fetch model status.", "error": str(e)},
        )


@router.post("/retrain")
async def triggerRetrain():
    """Manually trigger a full model retrain on all collected training data."""
    try:
        classifier.retrain()
        return {"message": "Retrain complete.", **classifier.get_status()}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"message": "Retrain failed.", "error": str(e)},
        )


@router.get("/schema")
async def getClassifierSchema():
    """Return a machine-readable schema describing classifier inputs and categories."""
    try:
        return FEATURE_SCHEMA
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"message": "Could not fetch classifier schema.", "error": str(e)},
        )
