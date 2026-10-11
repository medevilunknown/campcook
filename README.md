# CampCook

CampCook is a mobile-first food ordering and caterer operations platform designed for campus and community dining experiences. It connects customers with a fast ordering flow and gives caterers a simple dashboard to manage menu items, orders, sales, and queue status.

## Overview

The project includes:
- a customer-facing app for browsing food, placing orders, and tracking purchases
- a caterer workspace for managing kitchen operations and sales
- a FastAPI backend for auth, order processing, and state management
- Expo/React Native frontend for a smooth mobile experience

## Features

### Customer experience
- browse menu items and categories
- add items to cart and checkout securely
- review order history and current status
- sign in and persist the user session

### Caterer experience
- caterer login and role-based access
- manage daily sales and order tracking
- export sales information
- monitor operational queue and status updates

## Tech stack

- Frontend: Expo, React Native, TypeScript
- Backend: Python, FastAPI
- Authentication: Google sign-in and local session-based auth patterns
- Testing: pytest and UI regression checks

## Repository structure

- `backend/` – FastAPI server, auth routes, and API logic
- `frontend/` – Expo mobile app and UI screens
- `tests/` – automated regression and verification checks
- `memory/` – product requirements and internal notes
- `test_reports/` – test and QA reporting artifacts

## Getting started

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn server:app --reload
```

### Frontend

```bash
cd frontend
npm install
npx expo start
```

## Environment notes

This project may use local environment files and generated credentials during development. Keep those values out of version control and ensure they are included in the repository ignore rules before publishing.

## Project status

CampCook is actively developed as a working app prototype with backend and frontend flows integrated for demo and validation use.

## License

This project is intended for educational and demo purposes unless otherwise specified by the repository owner.

## Contributing

Pull requests, issue reports, and feature suggestions are welcome. Please keep changes focused and test relevant flows before submitting.
