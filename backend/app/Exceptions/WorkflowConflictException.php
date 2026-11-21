<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Raised when a status update conflicts with the current state of a request
 * (stale version or a transition the workflow does not allow). Rendered as 409.
 */
class WorkflowConflictException extends RuntimeException
{
    public const STALE_VERSION = 'STALE_VERSION';
    public const INVALID_TRANSITION = 'INVALID_TRANSITION';

    /** @param array<string, mixed> $context extra fields merged into the JSON body */
    public function __construct(
        public readonly string $errorCode,
        string $message,
        public readonly array $context = [],
    ) {
        parent::__construct($message);
    }
}
