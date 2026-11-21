<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ServiceRequestController;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function () {
    Route::post('login', [AuthController::class, 'login'])->middleware('throttle:login');

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('me', [AuthController::class, 'me']);
        Route::post('logout', [AuthController::class, 'logout']);
    });
});

Route::middleware('auth:sanctum')->prefix('requests')->group(function () {
    Route::get('/', [ServiceRequestController::class, 'index']);
    Route::post('/', [ServiceRequestController::class, 'store']);
    Route::get('{id}', [ServiceRequestController::class, 'show'])->whereNumber('id');
    Route::get('{id}/history', [ServiceRequestController::class, 'history'])->whereNumber('id');
});
