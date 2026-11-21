<?php

namespace Tests\Unit;

use App\Enums\RequestStatus;
use PHPUnit\Framework\TestCase;

class RequestStatusTest extends TestCase
{
    public function test_only_forward_single_step_transitions_are_allowed(): void
    {
        $allowed = [];
        foreach (RequestStatus::cases() as $from) {
            foreach (RequestStatus::cases() as $to) {
                if ($from->canTransitionTo($to)) {
                    $allowed[] = $from->value.'->'.$to->value;
                }
            }
        }

        $this->assertSame(['OPEN->IN_PROGRESS', 'IN_PROGRESS->RESOLVED'], $allowed);
        $this->assertNull(RequestStatus::RESOLVED->next());
    }
}
