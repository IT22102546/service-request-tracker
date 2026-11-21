<?php

namespace App\Enums;

/**
 * Workflow: OPEN -> IN_PROGRESS -> RESOLVED.
 * No skipping, no reversing, RESOLVED is terminal.
 */
enum RequestStatus: string
{
    case OPEN = 'OPEN';
    case IN_PROGRESS = 'IN_PROGRESS';
    case RESOLVED = 'RESOLVED';

    /** The single status this one may move to, or null when terminal. */
    public function next(): ?self
    {
        return match ($this) {
            self::OPEN => self::IN_PROGRESS,
            self::IN_PROGRESS => self::RESOLVED,
            self::RESOLVED => null,
        };
    }

    public function canTransitionTo(self $target): bool
    {
        return $this->next() === $target;
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
