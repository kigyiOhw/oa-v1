from pydantic import BaseModel, Field


class CompanyInfo(BaseModel):
    name: str = "OA System"
    logo_url: str = ""
    description: str = ""
    address: str = ""
    contact: str = ""


class QuickLink(BaseModel):
    name: str
    url: str
    icon: str = "link"


class QuickLinksUpdate(BaseModel):
    links: list[QuickLink] = Field(default_factory=list)
