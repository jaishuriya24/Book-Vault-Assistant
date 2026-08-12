package com.book.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public class PositionUpdateRequest {

    @NotNull(message = "lastPositionChar is required")
    @Min(value = 0, message = "Position must be greater than or equal to 0")
    private Integer lastPositionChar;

    public Integer getLastPositionChar() { return lastPositionChar; }
    public void setLastPositionChar(Integer lastPositionChar) { this.lastPositionChar = lastPositionChar; }
}
	