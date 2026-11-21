<?php

use App\Exceptions\WorkflowConflictException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Session\TokenMismatchException;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Sanctum SPA auth: requests from the Next.js origin get session
        // cookies + CSRF protection on /api routes.
        $middleware->statefulApi();
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        /*
         * Every API error uses the same envelope:
         *   { "message": string, "code": string, "errors"?: object, ... }
         */
        $json = fn (int $status, string $code, string $message, array $extra = []) => response()->json(
            array_merge(['message' => $message, 'code' => $code], $extra),
            $status,
        );

        $exceptions->render(function (ValidationException $e, Request $request) use ($json) {
            if ($request->is('api/*')) {
                return $json(422, 'VALIDATION_FAILED', $e->getMessage(), ['errors' => $e->errors()]);
            }
        });

        $exceptions->render(function (AuthenticationException $e, Request $request) use ($json) {
            if ($request->is('api/*')) {
                return $json(401, 'UNAUTHENTICATED', 'Unauthenticated.');
            }
        });

        $exceptions->render(function (AccessDeniedHttpException|AuthorizationException $e, Request $request) use ($json) {
            if ($request->is('api/*')) {
                return $json(403, 'FORBIDDEN', 'This action is unauthorized.');
            }
        });

        // Unknown records and records owned by someone else both end up here
        // (queries are scoped to the owner), so the API never reveals whether
        // another user's request id exists.
        $exceptions->render(function (NotFoundHttpException $e, Request $request) use ($json) {
            if ($request->is('api/*')) {
                $message = $e->getPrevious() instanceof ModelNotFoundException
                    ? 'Service request not found.'
                    : 'Resource not found.';

                return $json(404, 'NOT_FOUND', $message);
            }
        });

        $exceptions->render(function (WorkflowConflictException $e, Request $request) use ($json) {
            return $json(409, $e->errorCode, $e->getMessage(), $e->context);
        });

        $exceptions->render(function (HttpExceptionInterface $e, Request $request) use ($json) {
            if ($request->is('api/*')) {
                $status = $e->getStatusCode();
                $code = match ($status) {
                    419 => 'CSRF_TOKEN_MISMATCH',
                    429 => 'TOO_MANY_REQUESTS',
                    default => 'HTTP_'.$status,
                };

                return $json($status, $code, $e->getMessage() ?: 'Request failed.');
            }
        });
    })->create();
