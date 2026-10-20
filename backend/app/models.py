from pydantic import BaseModel, Field
from typing import Optional, List

class LoginRequest(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    name: str
    role: str
    class_id: Optional[int] = None
    class_name: Optional[str] = None

class LoginResponse(BaseModel):
    token: str
    user: UserResponse

class ClassCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = ""

class ClassResponse(BaseModel):
    id: int
    name: str
    description: str
    created_at: str
    student_count: int = 0
    lesson_count: int = 0
    average_rating: Optional[float] = None

class StudentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    class_id: int
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=4, max_length=50)

class StudentResponse(BaseModel):
    id: int
    username: str
    name: str
    role: str
    class_id: int
    class_name: str
    created_at: str
    ratings_count: int = 0

class LessonCreate(BaseModel):
    class_id: int
    title: str = Field(..., min_length=1, max_length=200)
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$") # YYYY-MM-DD
    start_time: str = Field(..., pattern=r"^\d{2}:\d{2}$")   # HH:MM
    end_time: str = Field(..., pattern=r"^\d{2}:\d{2}$")     # HH:MM
    description: Optional[str] = ""

class LessonResponse(BaseModel):
    id: int
    class_id: int
    class_name: str
    title: str
    date: str
    start_time: str
    end_time: str
    description: str
    created_at: str
    ratings_count: int = 0
    average_score: Optional[float] = None
    has_rated: bool = False
    student_rating: Optional[dict] = None
    can_rate: bool = False
    rate_reason: Optional[str] = None

class RatingCreate(BaseModel):
    lesson_id: int
    score_clarity: int = Field(..., ge=0, le=10)
    score_engagement: int = Field(..., ge=0, le=10)
    score_atmosphere: int = Field(..., ge=0, le=10)
    comment: Optional[str] = ""

class RatingResponse(BaseModel):
    id: int
    lesson_id: int
    lesson_title: str
    lesson_date: str
    class_id: int
    class_name: str
    student_id: int
    student_name: str
    score_clarity: int
    score_engagement: int
    score_atmosphere: int
    average_score: float
    comment: str
    created_at: str
